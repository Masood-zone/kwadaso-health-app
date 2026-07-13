import type { NextRequest } from "next/server"

import { ensureMutableEncounter, generatePrescriptionNo, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { prescriptionInclude, serializePrescription } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { prescriptionSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { notifyBillingService } from "@/lib/billing"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = prescriptionSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const record = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const medicationIds = [...new Set(parsed.data.items.flatMap((item) => item.medicationId ? [item.medicationId] : []))]
      if (medicationIds.length) {
        const count = await tx.medication.count({ where: { id: { in: medicationIds }, facilityId: actor.facilityId, isActive: true } })
        if (count !== medicationIds.length) throw new Error("MEDICATION_NOT_FOUND")
      }
      const created = await tx.prescription.create({ data: { prescriptionNo: generatePrescriptionNo(), patientId: checked.encounter.patientId, encounterId: id, prescribedById: actor.id, status: parsed.data.status, notes: parsed.data.notes, issuedAt: parsed.data.status === "ISSUED" ? new Date() : null, items: { create: parsed.data.items } }, include: prescriptionInclude })
      if (created.status === "ISSUED") {
        await tx.encounter.update({ where: { id }, data: { status: "AWAITING_PHARMACY" } })
        if (checked.encounter.queueId) await tx.patientQueue.update({ where: { id: checked.encounter.queueId }, data: { status: "AWAITING_PHARMACY" } })
        await tx.notification.create({ data: { facilityId: actor.facilityId, createdById: actor.id, targetRole: "PHARMACIST", type: "MESSAGE", title: `Prescription ${created.prescriptionNo} ready`, actionUrl: `/pharmacy/prescriptions/${created.id}`, entityType: "Prescription", entityId: created.id } })
        await notifyBillingService(tx, { facilityId: actor.facilityId, createdById: actor.id, entityType: "Prescription", entityId: created.id, title: "Prescription available for billing review", body: `${created.prescriptionNo} contains ${created.items.length} medication item${created.items.length === 1 ? "" : "s"}.` })
      }
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "Prescription", entityId: created.id, description: `${created.status === "ISSUED" ? "Issued" : "Drafted"} prescription ${created.prescriptionNo}`, after: { encounterId: id, status: created.status, itemCount: created.items.length } })
      return created
    })
    return ok(serializePrescription(record))
  })
}
