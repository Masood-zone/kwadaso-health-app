import type { NextRequest } from "next/server"

import { AuditAction } from "@/lib/generated/prisma/enums"
import { billingNotificationWhere, billingOk, BillingError, serializeBillingNotification, withBilling, writeBillingAuditLog } from "@/lib/billing"
import { notificationUpdateSchema } from "@/lib/billing-schemas"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const parsed = notificationUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Notification status is invalid.", code: "VALIDATION_ERROR" }, { status: 400 })
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.notification.findFirst({ where: { id, ...billingNotificationWhere(actor) } })
      if (!existing) throw new BillingError("Notification was not found.", "NOTIFICATION_NOT_FOUND", 404)
      const record = await tx.notification.update({ where: { id }, data: { status: parsed.data.status, readAt: parsed.data.status === "READ" ? new Date() : existing.readAt } })
      await writeBillingAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "Notification", entityId: id, description: `${parsed.data.status === "READ" ? "Read" : "Archived"} billing notification`, before: { status: existing.status }, after: { status: record.status } })
      return record
    })
    return billingOk(serializeBillingNotification(updated))
  })
}
