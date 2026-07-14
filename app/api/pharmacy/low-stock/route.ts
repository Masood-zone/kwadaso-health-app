import type { NextRequest } from "next/server"
import { pharmacyOk, reconcileLowStockNotification, serializeStock, withPharmacy } from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const stocks = await prisma.medicationStock.findMany({ where: { facilityId: actor.facilityId }, include: { medication: true, movements: { include: { performedBy: true }, orderBy: { createdAt: "desc" }, take: 20 }, reorders: { where: { status: { in: ["REQUESTED", "ORDERED"] } }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { quantityOnHand: "asc" }, take: 500 })
    const low = stocks.filter((stock) => stock.quantityOnHand <= stock.medication.reorderLevel)
    await Promise.all(low.map((stock) => reconcileLowStockNotification(prisma, stock, actor.id)))
    return pharmacyOk(low.map((stock) => ({ ...serializeStock(stock), shortageAmount: Math.max(0, stock.medication.reorderLevel - stock.quantityOnHand), recommendedQuantity: Math.max(stock.medication.reorderLevel * 2 - stock.quantityOnHand, stock.medication.reorderLevel), activeReorder: stock.reorders[0] ? { id: stock.reorders[0].id, reference: stock.reorders[0].reference, requestedQuantity: stock.reorders[0].requestedQuantity, status: stock.reorders[0].status } : null })))
  })
}
