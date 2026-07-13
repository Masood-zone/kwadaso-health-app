import type { NextRequest } from "next/server"
import { pharmacyOk, serializePharmacyNotification, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { notificationUpdateSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withPharmacy(request, async (actor) => { const { id } = await context.params; const parsed = notificationUpdateSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ success: false, message: "Notification update is invalid." }, { status: 400 }); const row = await prisma.$transaction(async (tx) => { const before = await tx.notification.findFirst({ where: { id, facilityId: actor.facilityId, OR: [{ recipientId: actor.id }, { targetRole: "PHARMACIST" }, ...(actor.departmentId ? [{ targetDepartmentId: actor.departmentId }] : [])] } }); if (!before) throw new Error("NOTIFICATION_NOT_FOUND"); const updated = await tx.notification.update({ where: { id }, data: { status: parsed.data.status, readAt: parsed.data.status === "READ" ? (before.readAt ?? new Date()) : before.readAt } }); await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "Notification", entityId: id, description: `Marked pharmacy notification ${updated.status.toLowerCase()}`, before: { status: before.status }, after: { status: updated.status } }); return updated }); return pharmacyOk(serializePharmacyNotification(row)) })
}

