import type { NextRequest } from "next/server"
import { apiError, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { serializeNotification } from "@/lib/clinician-data"
import { notificationWhere, ok, withClinician } from "@/lib/clinician-route"
import { notificationUpdateSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = notificationUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const visible = await prisma.notification.findFirst({ where: { id, ...notificationWhere(actor) } })
    if (!visible) return apiError("Notification was not found.", 404)
    const updated = await prisma.notification.update({ where: { id }, data: { status: parsed.data.status, readAt: parsed.data.status === "READ" ? (visible.readAt ?? new Date()) : visible.readAt } })
    await writeClinicianAuditLog({ request, actor, action: AuditAction.UPDATE, entityType: "Notification", entityId: id, description: `Marked notification ${parsed.data.status.toLowerCase()}` })
    return ok(serializeNotification(updated))
  })
}

