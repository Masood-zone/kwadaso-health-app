import type { NextRequest } from "next/server"
import { ensurePharmacyPrescription, pharmacyOk, pharmacyPrescriptionInclude, serializePrescriptionDetail, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { prescriptionCancelSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }
export async function GET(request: NextRequest, context: Context) {
  return withPharmacy(request, async (actor) => { const { id } = await context.params; const row = await ensurePharmacyPrescription(id, actor.facilityId); if (!row) throw new Error("PRESCRIPTION_NOT_FOUND"); return pharmacyOk(await serializePrescriptionDetail(row)) })
}

export async function PATCH(request: NextRequest, context: Context) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params
    const parsed = prescriptionCancelSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Prescription cancellation requires a reason." }, { status: 400 })
    const row = await prisma.$transaction(async (tx) => {
      const before = await ensurePharmacyPrescription(id, actor.facilityId, tx)
      if (!before) throw new Error("PRESCRIPTION_NOT_FOUND")
      if (!["ISSUED", "PARTIALLY_DISPENSED"].includes(before.status)) throw new Error("PRESCRIPTION_LOCKED")
      const updated = await tx.prescription.update({ where: { id }, data: { status: "CANCELLED", cancellationReason: parsed.data.cancellationReason, cancelledAt: new Date(), cancelledById: actor.id }, include: pharmacyPrescriptionInclude })
      if (updated.encounterId) {
        const encounter = await tx.encounter.updateMany({ where: { id: updated.encounterId, facilityId: actor.facilityId, status: "AWAITING_PHARMACY" }, data: { status: "IN_PROGRESS" } })
        if (encounter.count && before.encounter?.queueId) await tx.patientQueue.updateMany({ where: { id: before.encounter.queueId, status: "AWAITING_PHARMACY" }, data: { status: "WITH_CLINICIAN" } })
      }
      if (updated.prescribedById) await tx.notification.create({ data: { recipientId: updated.prescribedById, facilityId: actor.facilityId, createdById: actor.id, type: "MESSAGE", priority: "HIGH", title: `Prescription ${updated.prescriptionNo} returned`, body: parsed.data.cancellationReason, actionUrl: updated.encounterId ? `/clinician/encounters/${updated.encounterId}` : "/clinician/prescriptions", entityType: "Prescription", entityId: updated.id } })
      await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.REJECT, entityType: "Prescription", entityId: id, description: `Cancelled prescription ${updated.prescriptionNo}`, before: { status: before.status }, after: { status: updated.status, reason: parsed.data.cancellationReason } })
      return updated
    })
    return pharmacyOk(await serializePrescriptionDetail(row))
  })
}
