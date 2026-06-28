import { NextRequest } from "next/server"
import { z } from "zod"

import { requireNurseApi, serializeNotification, writeNurseAuditLog } from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  status: z.enum(["READ", "ARCHIVED"]),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Notification update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.notification.findFirst({
    where: {
      id,
      facilityId: actor!.facilityId,
      OR: [
        { recipientId: actor!.id },
        { targetRole: "NURSE" },
        { targetDepartmentId: actor!.departmentId },
      ],
    },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Notification was not found." },
      { status: 404 }
    )
  }

  const notification = await prisma.notification.update({
    where: { id },
    data: {
      status: parsed.data.status,
      readAt: parsed.data.status === "READ" ? new Date() : before.readAt,
    },
  })

  await writeNurseAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "Notification",
    entityId: id,
    description: `Updated nurse notification ${notification.title}`,
    before: { status: before.status },
    after: { status: notification.status },
  })

  return Response.json({
    success: true,
    data: serializeNotification(notification),
  } satisfies ApiResponse)
}
