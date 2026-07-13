import type { NextRequest } from "next/server"
import { ensurePharmacyStock, generateReorderReference, pharmacyOk, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { reorderCreateSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, context: { params: Promise<{ stockId: string }> }) {
  return withPharmacy(request, async (actor) => { const { stockId } = await context.params; const parsed = reorderCreateSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ success: false, message: "Reorder details are invalid." }, { status: 400 }); const record = await prisma.$transaction(async (tx) => { const stock = await ensurePharmacyStock(stockId, actor.facilityId, tx); if (!stock) throw new Error("STOCK_NOT_FOUND"); const created = await tx.pharmacyReorder.create({ data: { reference: parsed.data.reference || generateReorderReference(), facilityId: actor.facilityId, medicationId: stock.medicationId, stockId, requestedQuantity: parsed.data.requestedQuantity, notes: parsed.data.notes, createdById: actor.id }, include: { medication: true, createdBy: true } }); await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "PharmacyReorder", entityId: created.id, description: `Created reorder ${created.reference} for ${created.medication.name}`, after: { requestedQuantity: created.requestedQuantity, stockId } }); return created }); return pharmacyOk({ id: record.id, reference: record.reference, medicationId: record.medicationId, medicationName: record.medication.name, stockId: record.stockId, requestedQuantity: record.requestedQuantity, status: record.status, notes: record.notes, createdByName: record.createdBy?.name ?? null, createdAt: record.createdAt.toISOString() }, "Reorder request created.", 201) })
}

