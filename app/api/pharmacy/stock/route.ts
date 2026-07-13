import type { NextRequest } from "next/server"
import type { Prisma } from "@/lib/generated/prisma/client"
import { pharmacyOk, pharmacyPage, parsePharmacyPagination, reconcileLowStockNotification, serializeStock, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { stockCreateSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const params = request.nextUrl.searchParams; const { page, pageSize, skip } = parsePharmacyPagination(params); const search = params.get("search")?.trim(); const batch = params.get("batch")?.trim(); const expiry = params.get("expiry"); const lowStock = params.get("lowStock") === "true"
    const where: Prisma.MedicationStockWhereInput = { facilityId: actor.facilityId, ...(batch ? { batchNumber: { contains: batch, mode: "insensitive" } } : {}), ...(search ? { medication: { facilityId: actor.facilityId, OR: [{ name: { contains: search, mode: "insensitive" } }, { genericName: { contains: search, mode: "insensitive" } }] } } : {}), ...(expiry === "expired" ? { expiryDate: { lt: new Date() } } : expiry === "soon" ? { expiryDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) } } : {}) }
    const all = await prisma.medicationStock.findMany({ where, include: { medication: true, movements: { include: { performedBy: true }, orderBy: { createdAt: "desc" } } }, orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }] })
    const filtered = lowStock ? all.filter((stock) => stock.quantityOnHand <= stock.medication.reorderLevel) : all
    return pharmacyOk(pharmacyPage(filtered.slice(skip, skip + pageSize).map(serializeStock), filtered.length, page, pageSize))
  })
}

export async function POST(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const parsed = stockCreateSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ success: false, message: "Stock details are invalid.", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    const row = await prisma.$transaction(async (tx) => {
      const medication = await tx.medication.findFirst({ where: { id: parsed.data.medicationId, facilityId: actor.facilityId, isActive: true } }); if (!medication) throw new Error("MEDICATION_NOT_FOUND")
      const created = await tx.medicationStock.create({ data: { facilityId: actor.facilityId, medicationId: medication.id, batchNumber: parsed.data.batchNumber, expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null, quantityOnHand: parsed.data.quantityOnHand, unitCost: parsed.data.unitCost, sellingPrice: parsed.data.sellingPrice } })
      if (parsed.data.quantityOnHand > 0) await tx.stockMovement.create({ data: { stockId: created.id, medicationId: medication.id, type: "OPENING_BALANCE", quantity: parsed.data.quantityOnHand, reason: "Opening stock balance", reference: parsed.data.reference, performedById: actor.id } })
      const full = await tx.medicationStock.findUniqueOrThrow({ where: { id: created.id }, include: { medication: true, movements: { include: { performedBy: true }, orderBy: { createdAt: "desc" } } } })
      await reconcileLowStockNotification(tx, full, actor.id)
      await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "MedicationStock", entityId: created.id, description: `Created stock batch for ${medication.name}`, after: { batchNumber: created.batchNumber, quantityOnHand: created.quantityOnHand } })
      return full
    })
    return pharmacyOk(serializeStock(row), "Stock batch created.", 201)
  })
}

