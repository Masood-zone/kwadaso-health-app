import type { NextRequest } from "next/server"
import { pharmacyOk, serializeMedication, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { medicationUpdateSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }
export async function GET(request: NextRequest, context: Context) {
  return withPharmacy(request, async (actor) => { const { id } = await context.params; const row = await prisma.medication.findFirst({ where: { id, facilityId: actor.facilityId }, include: { stocks: { where: { facilityId: actor.facilityId } } } }); if (!row) throw new Error("MEDICATION_NOT_FOUND"); return pharmacyOk(serializeMedication(row)) })
}
export async function PATCH(request: NextRequest, context: Context) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params; const parsed = medicationUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Medication update is invalid." }, { status: 400 })
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.medication.findFirst({ where: { id, facilityId: actor.facilityId } }); if (!before) throw new Error("MEDICATION_NOT_FOUND")
      const updated = await tx.medication.update({ where: { id }, data: parsed.data, include: { stocks: { where: { facilityId: actor.facilityId } } } })
      await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "Medication", entityId: id, description: `Updated medication ${updated.name}`, before: { code: before.code, name: before.name, isActive: before.isActive, reorderLevel: before.reorderLevel }, after: { code: updated.code, name: updated.name, isActive: updated.isActive, reorderLevel: updated.reorderLevel } })
      return updated
    })
    return pharmacyOk(serializeMedication(row))
  })
}

