import { NextRequest } from "next/server"
import { z } from "zod"

import { requireLaboratoryApi, serializeLaboratoryNotification, writeLaboratoryAuditLog } from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LaboratoryNotificationItem } from "@/types/laboratory"

const schema = z.object({ status: z.enum(["READ", "ARCHIVED"]) })

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ success: false, message: "Notification update is invalid." }, { status: 400 })
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.notification.findFirst({
        where: {
          id,
          facilityId: actor!.facilityId,
          type: { in: ["LAB_RESULT", "CRITICAL_ALERT"] },
          OR: [{ recipientId: actor!.id }, { targetRole: "LAB_TECHNICIAN" }, ...(actor!.departmentId ? [{ targetDepartmentId: actor!.departmentId }] : [])],
        },
      })
      if (!before) throw new Error("NOT_FOUND")
      const notification = await tx.notification.update({
        where: { id },
        data: { status: parsed.data.status, readAt: parsed.data.status === "READ" ? new Date() : before.readAt },
      })
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "UPDATE",
        entityType: "Notification",
        entityId: id,
        description: `Updated laboratory notification ${notification.title}`,
        before: { status: before.status },
        after: { status: notification.status },
      })
      return notification
    })
    return Response.json({ success: true, data: serializeLaboratoryNotification(updated) } satisfies ApiResponse<LaboratoryNotificationItem>)
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ success: false, message: "Notification was not found." }, { status: 404 })
    return Response.json({ success: false, message: "Notification could not be updated." }, { status: 500 })
  }
}
