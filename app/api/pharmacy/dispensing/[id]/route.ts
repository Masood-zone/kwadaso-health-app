import type { NextRequest } from "next/server"
import { dispensingUpdateSchema } from "@/lib/pharmacy-schemas"
import { pharmacyDispensingInclude, pharmacyOk, serializeDispensing, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }
export async function GET(request: NextRequest, context: Context) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params
    const row = await prisma.dispensing.findFirst({ where: { id, patient: { registeredFacilityId: actor.facilityId } }, include: pharmacyDispensingInclude })
    if (!row) throw new Error("DISPENSING_NOT_FOUND")
    const movements = await prisma.stockMovement.findMany({ where: { reference: row.dispenseNo }, include: { medication: true, stock: true, performedBy: true }, orderBy: { createdAt: "asc" } })
    const audits = await prisma.auditLog.findMany({ where: { OR: [{ entityId: row.id }, { after: { path: ["prescriptionId"], equals: row.prescriptionId } }] }, orderBy: { createdAt: "asc" } })
    return pharmacyOk({ ...serializeDispensing(row), notes: row.notes, counsellingNotes: row.counsellingNotes, partialDispenseReason: row.partialDispenseReason, cancellationReason: row.cancellationReason, items: row.items.map((item) => ({ id: item.id, prescriptionItemId: item.prescriptionItemId, medicationId: item.medicationId, medicineName: item.medicineName, batchNumber: item.stock?.batchNumber ?? null, quantityDispensed: item.quantityDispensed, notes: item.notes })), movements: movements.map((movement) => ({ id: movement.id, type: movement.type, quantity: movement.quantity, medicationName: movement.medication.name, batchNumber: movement.stock.batchNumber, createdAt: movement.createdAt.toISOString() })), auditSummary: audits.map((audit) => ({ id: audit.id, action: audit.action, description: audit.description, createdAt: audit.createdAt.toISOString() })) })
  })
}

export async function PATCH(request: NextRequest, context: Context) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params
    const parsed = dispensingUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Dispensing update is invalid." }, { status: 400 })
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.dispensing.findFirst({ where: { id, patient: { registeredFacilityId: actor.facilityId } } })
      if (!before) throw new Error("DISPENSING_NOT_FOUND")
      if (before.status !== "PENDING") throw new Error("DISPENSING_LOCKED")
      if (parsed.data.cancel && !parsed.data.cancellationReason) throw new Error("CANCELLATION_REASON_REQUIRED")
      const updated = await tx.dispensing.update({ where: { id }, data: { notes: parsed.data.notes, counsellingNotes: parsed.data.counsellingNotes, ...(parsed.data.cancel ? { status: "CANCELLED", cancellationReason: parsed.data.cancellationReason, cancelledAt: new Date(), cancelledById: actor.id } : {}) }, include: pharmacyDispensingInclude })
      await writePharmacyAuditLog({ client: tx, request, actor, action: parsed.data.cancel ? AuditAction.REJECT : AuditAction.UPDATE, entityType: "Dispensing", entityId: id, description: `${parsed.data.cancel ? "Cancelled" : "Updated"} pending dispensing ${updated.dispenseNo}`, before: { status: before.status }, after: { status: updated.status } })
      return updated
    })
    return pharmacyOk(serializeDispensing(row))
  })
}

