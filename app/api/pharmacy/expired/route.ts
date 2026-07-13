import type { NextRequest } from "next/server"
import { isExpired, isExpiringSoon, pharmacyOk, serializeStock, withPharmacy } from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => { const rows = await prisma.medicationStock.findMany({ where: { facilityId: actor.facilityId, expiryDate: { not: null, lte: new Date(Date.now() + 30 * 86400000) } }, include: { medication: true, movements: { include: { performedBy: true }, orderBy: { createdAt: "desc" } }, reorders: true }, orderBy: { expiryDate: "asc" } }); return pharmacyOk(rows.map((stock) => ({ ...serializeStock(stock), expiryStatus: isExpired(stock.expiryDate) ? "EXPIRED" : isExpiringSoon(stock.expiryDate) ? "EXPIRING_SOON" : "CURRENT", disposalStatus: stock.movements.some((movement) => movement.type === "EXPIRED") ? (stock.quantityOnHand === 0 ? "RECORDED" : "PARTIAL") : "PENDING", disposalMovements: stock.movements.filter((movement) => movement.type === "EXPIRED").map((movement) => ({ id: movement.id, quantity: movement.quantity, reason: movement.reason, reference: movement.reference, createdAt: movement.createdAt.toISOString() })) }))) })
}

