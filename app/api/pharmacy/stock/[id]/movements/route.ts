import type { NextRequest } from "next/server"
import { ensurePharmacyStock, pharmacyOk, reconcileLowStockNotification, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { stockMovementSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

const increases = new Set(["PURCHASE", "DONATION", "ADJUSTMENT_IN", "TRANSFER_IN"])

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params; const parsed = stockMovementSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Stock movement is invalid.", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    const result = await prisma.$transaction(async (tx) => {
      const stock = await ensurePharmacyStock(id, actor.facilityId, tx); if (!stock) throw new Error("STOCK_NOT_FOUND")
      let reversalOfId: string | null = null
      if (parsed.data.reversalOfMovementId) {
        const original = await tx.stockMovement.findFirst({ where: { id: parsed.data.reversalOfMovementId, stockId: id }, include: { reversal: true } })
        if (!original) throw new Error("MOVEMENT_NOT_FOUND")
        if (original.reversal) throw new Error("MOVEMENT_ALREADY_REVERSED")
        if (increases.has(original.type) === increases.has(parsed.data.type)) throw new Error("MOVEMENT_NOT_ALLOWED")
        reversalOfId = original.id
      }
      const increase = increases.has(parsed.data.type)
      if (!increase) { const changed = await tx.medicationStock.updateMany({ where: { id, quantityOnHand: { gte: parsed.data.quantity } }, data: { quantityOnHand: { decrement: parsed.data.quantity } } }); if (changed.count !== 1) throw new Error("INSUFFICIENT_STOCK") }
      else await tx.medicationStock.update({ where: { id }, data: { quantityOnHand: { increment: parsed.data.quantity } } })
      const movement = await tx.stockMovement.create({ data: { stockId: id, medicationId: stock.medicationId, type: parsed.data.type, quantity: parsed.data.quantity, reason: parsed.data.reason, reference: parsed.data.reference, performedById: actor.id, reversalOfId }, include: { medication: true, stock: true, performedBy: true } })
      const updated = await tx.medicationStock.findUniqueOrThrow({ where: { id }, include: { medication: true } }); await reconcileLowStockNotification(tx, updated, actor.id)
      await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "StockMovement", entityId: movement.id, description: `Recorded ${movement.type} for ${movement.medication.name}`, before: { quantityOnHand: stock.quantityOnHand }, after: { quantityOnHand: updated.quantityOnHand, quantity: movement.quantity, reversalOfId } })
      return { id: movement.id, type: movement.type, quantity: movement.quantity, reason: movement.reason, reference: movement.reference, reversalOfId: movement.reversalOfId, quantityOnHand: updated.quantityOnHand, createdAt: movement.createdAt.toISOString() }
    })
    return pharmacyOk(result, "Stock movement recorded.", 201)
  })
}

