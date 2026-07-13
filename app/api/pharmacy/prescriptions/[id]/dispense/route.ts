import type { NextRequest } from "next/server"

import { ensurePharmacyPrescription, generateDispenseNo, isExpired, pharmacyDispensingInclude, pharmacyOk, reconcileLowStockNotification, serializeDispensing, serializePrescriptionDetail, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { dispensingCreateSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { notifyBillingService } from "@/lib/billing"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params
    const parsed = dispensingCreateSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Dispensing details are invalid.", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    const result = await prisma.$transaction(async (tx) => {
      const prescription = await ensurePharmacyPrescription(id, actor.facilityId, tx)
      if (!prescription) throw new Error("PRESCRIPTION_NOT_FOUND")
      if (!["ISSUED", "PARTIALLY_DISPENSED"].includes(prescription.status)) throw new Error("PRESCRIPTION_LOCKED")
      const detail = await serializePrescriptionDetail(prescription, tx)
      const payloadByItem = new Map<string, number>()
      for (const item of parsed.data.items) payloadByItem.set(item.prescriptionItemId, (payloadByItem.get(item.prescriptionItemId) ?? 0) + item.quantityDispensed)
      for (const [itemId, quantity] of payloadByItem) {
        const prescribed = detail.items.find((item) => item.id === itemId)
        if (!prescribed || !prescribed.medicationId || quantity > prescribed.remainingQuantity) throw new Error("INVALID_DISPENSE_ITEM")
      }
      const relevantWarnings = detail.warnings.filter((warning) => warning.prescriptionItemId && payloadByItem.has(warning.prescriptionItemId) && warning.requiresReason)
      for (const warning of relevantWarnings) {
        const override = parsed.data.safetyOverrides?.find((item) => item.type === warning.type && (!item.prescriptionItemId || item.prescriptionItemId === warning.prescriptionItemId))
        if (!override?.reason.trim()) throw new Error("SAFETY_OVERRIDE_REQUIRED")
      }
      const completed = detail.items.every((item) => item.remainingQuantity - (payloadByItem.get(item.id) ?? 0) <= 0)
      if (!completed && !parsed.data.partialDispenseReason?.trim()) throw new Error("PARTIAL_REASON_REQUIRED")
      const session = await tx.dispensing.create({ data: { dispenseNo: generateDispenseNo(), prescriptionId: prescription.id, patientId: prescription.patientId, status: completed ? "COMPLETED" : "PARTIAL", dispensedById: actor.id, dispensedAt: new Date(), notes: parsed.data.notes, counsellingNotes: parsed.data.counsellingNotes, partialDispenseReason: completed ? null : parsed.data.partialDispenseReason } })
      const remainingStock: Array<{ stockId: string; quantityOnHand: number }> = []
      for (const item of parsed.data.items) {
        const prescribed = prescription.items.find((candidate) => candidate.id === item.prescriptionItemId)
        if (!prescribed || prescribed.medicationId !== item.medicationId) throw new Error("INVALID_DISPENSE_ITEM")
        const stock = await tx.medicationStock.findFirst({ where: { id: item.stockId, facilityId: actor.facilityId, medicationId: item.medicationId }, include: { medication: true } })
        if (!stock) throw new Error("STOCK_NOT_FOUND")
        if (isExpired(stock.expiryDate)) throw new Error("STOCK_EXPIRED")
        const changed = await tx.medicationStock.updateMany({ where: { id: stock.id, quantityOnHand: { gte: item.quantityDispensed }, OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }] }, data: { quantityOnHand: { decrement: item.quantityDispensed } } })
        if (changed.count !== 1) throw new Error("INSUFFICIENT_STOCK")
        await tx.dispenseItem.create({ data: { dispensingId: session.id, prescriptionItemId: prescribed.id, medicationId: item.medicationId, stockId: stock.id, medicineName: prescribed.medicineName, quantityDispensed: item.quantityDispensed, notes: item.notes } })
        await tx.stockMovement.create({ data: { stockId: stock.id, medicationId: stock.medicationId, type: "DISPENSE", quantity: item.quantityDispensed, reason: `Dispensed under ${prescription.prescriptionNo}`, reference: session.dispenseNo, performedById: actor.id } })
        const updatedStock = await tx.medicationStock.findUniqueOrThrow({ where: { id: stock.id }, include: { medication: true } })
        await reconcileLowStockNotification(tx, updatedStock, actor.id)
        remainingStock.push({ stockId: stock.id, quantityOnHand: updatedStock.quantityOnHand })
      }
      await tx.prescription.update({ where: { id: prescription.id }, data: { status: completed ? "DISPENSED" : "PARTIALLY_DISPENSED" } })
      await notifyBillingService(tx, { facilityId: actor.facilityId, createdById: actor.id, entityType: "Dispensing", entityId: session.id, title: "Dispensed medication ready for billing", body: `${session.dispenseNo} contains ${parsed.data.items.length} dispensed item${parsed.data.items.length === 1 ? "" : "s"}.` })
      if (completed && prescription.encounterId) {
        const encounter = await tx.encounter.updateMany({ where: { id: prescription.encounterId, status: "AWAITING_PHARMACY" }, data: { status: "COMPLETED", completedAt: new Date() } })
        if (encounter.count && prescription.encounter?.queueId) await tx.patientQueue.updateMany({ where: { id: prescription.encounter.queueId, status: "AWAITING_PHARMACY" }, data: { status: "COMPLETED", completedAt: new Date() } })
      }
      await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.DISPENSE, entityType: "Dispensing", entityId: session.id, description: `${completed ? "Completed" : "Partially completed"} dispensing ${session.dispenseNo}`, after: { prescriptionId: prescription.id, status: session.status, itemCount: parsed.data.items.length } })
      for (const override of parsed.data.safetyOverrides ?? []) await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.APPROVE, entityType: "PharmacySafetyOverride", entityId: session.id, description: `Acknowledged ${override.type.toLowerCase().replaceAll("_", " ")} warning`, after: { prescriptionItemId: override.prescriptionItemId ?? null, reason: override.reason } })
      const full = await tx.dispensing.findUniqueOrThrow({ where: { id: session.id }, include: pharmacyDispensingInclude })
      return { dispensing: serializeDispensing(full), items: full.items.map((item) => ({ id: item.id, medicineName: item.medicineName, batchNumber: item.stock?.batchNumber ?? null, quantityDispensed: item.quantityDispensed })), remainingStock }
    })
    return pharmacyOk(result, "Medication dispensed successfully.", 201)
  })
}
