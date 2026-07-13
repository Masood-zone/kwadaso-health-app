import type { NextRequest } from "next/server"
import { z } from "zod"
import { apiError, ensureMutableEncounter, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { prescriptionInclude, serializePrescription } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { prescriptionItemSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const row = await prisma.prescription.findFirst({ where: { id, encounter: { facilityId: actor.facilityId } }, include: prescriptionInclude })
    return row ? ok(serializePrescription(row)) : apiError("Prescription was not found.", 404)
  })
}

export async function PATCH(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = z.object({ status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]), notes: z.string().trim().nullable().optional(), items: z.array(prescriptionItemSchema).min(1).optional() }).safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.prescription.findFirst({ where: { id, prescribedById: actor.id, encounter: { facilityId: actor.facilityId } }, include: prescriptionInclude })
      if (!before) throw new Error("PRESCRIPTION_NOT_FOUND")
      if (["PARTIALLY_DISPENSED", "DISPENSED"].includes(before.status) || before.dispensings.length) throw new Error("PRESCRIPTION_LOCKED")
      if (before.encounterId) {
        const checked = await ensureMutableEncounter(before.encounterId, actor, tx)
        if (checked.error) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      }
      if (parsed.data.items) {
        await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } })
        await tx.prescriptionItem.createMany({ data: parsed.data.items.map((item) => ({ ...item, prescriptionId: id })) })
      }
      const updated = await tx.prescription.update({ where: { id }, data: { status: parsed.data.status, notes: parsed.data.notes, issuedAt: parsed.data.status === "ISSUED" ? (before.issuedAt ?? new Date()) : before.issuedAt }, include: prescriptionInclude })
      if (updated.status === "ISSUED" && updated.encounterId) {
        const encounter = await tx.encounter.update({ where: { id: updated.encounterId }, data: { status: "AWAITING_PHARMACY" } })
        if (encounter.queueId) await tx.patientQueue.update({ where: { id: encounter.queueId }, data: { status: "AWAITING_PHARMACY" } })
      }
      await writeClinicianAuditLog({ client: tx, request, actor, action: parsed.data.status === "CANCELLED" ? AuditAction.REJECT : AuditAction.UPDATE, entityType: "Prescription", entityId: id, description: `Updated prescription ${updated.prescriptionNo} to ${updated.status}`, before: { status: before.status }, after: { status: updated.status } })
      return updated
    })
    return ok(serializePrescription(row))
  })
}
