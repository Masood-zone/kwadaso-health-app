import { NextRequest } from "next/server"
import { z } from "zod"

import {
  assertNotSuperAdmin,
  requireHospitalAdminApi,
  serializeHospitalAdminNotification,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const notificationUpdateSchema = z.object({
  title: z.string().trim().min(2).optional(),
  message: z.string().trim().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  status: z.enum(["UNREAD", "READ", "ARCHIVED"]).optional(),
  targetRole: z
    .enum([
      "HOSPITAL_ADMIN",
      "MUNICIPAL_HEALTH_DIRECTOR",
      "M_AND_E_OFFICER",
      "RECORDS_OFFICER",
      "FRONT_DESK",
      "DOCTOR",
      "PHYSICIAN_ASSISTANT",
      "NURSE",
      "LAB_TECHNICIAN",
      "PHARMACIST",
      "BILLING_OFFICER",
    ])
    .optional()
    .nullable(),
  targetDepartmentId: z.string().trim().optional().nullable(),
  recipientUserId: z.string().trim().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const { id } = await context.params
  const parsed = notificationUpdateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Notification details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.notification.findFirst({
    where: { id, facilityId: actor!.facilityId },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Notification was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  if (values.targetRole && !assertNotSuperAdmin(values.targetRole as never)) {
    return Response.json(
      { success: false, message: "Notifications cannot target Super Admin." },
      { status: 403 }
    )
  }
  if (values.targetDepartmentId) {
    const department = await prisma.department.findFirst({
      where: { id: values.targetDepartmentId, facilityId: actor!.facilityId },
    })
    if (!department) {
      return Response.json(
        {
          success: false,
          message: "Target department was not found in this facility.",
        },
        { status: 400 }
      )
    }
  }
  if (values.recipientUserId) {
    const recipient = await prisma.user.findFirst({
      where: { id: values.recipientUserId, facilityId: actor!.facilityId },
    })
    if (!recipient) {
      return Response.json(
        {
          success: false,
          message: "Recipient was not found in this facility.",
        },
        { status: 400 }
      )
    }
  }

  const notification = await prisma.notification.update({
    where: { id },
    data: {
      ...(values.title !== undefined ? { title: values.title } : {}),
      ...(values.message !== undefined ? { body: values.message || null } : {}),
      ...(values.priority !== undefined ? { priority: values.priority } : {}),
      ...(values.status !== undefined
        ? {
            status: values.status,
            readAt: values.status === "READ" ? new Date() : before.readAt,
          }
        : {}),
      ...(values.targetRole !== undefined
        ? { targetRole: values.targetRole || null }
        : {}),
      ...(values.targetDepartmentId !== undefined
        ? { targetDepartmentId: values.targetDepartmentId || null }
        : {}),
      ...(values.recipientUserId !== undefined
        ? { recipientId: values.recipientUserId || null }
        : {}),
      ...(values.expiresAt !== undefined
        ? { expiresAt: values.expiresAt ? new Date(values.expiresAt) : null }
        : {}),
    },
    include: { recipient: true, createdBy: true, targetDepartment: true },
  })

  await writeHospitalAdminAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "Notification",
    entityId: notification.id,
    description: `Updated notification ${notification.title}`,
    before: {
      title: before.title,
      status: before.status,
      priority: before.priority,
    },
    after: {
      title: notification.title,
      status: notification.status,
      priority: notification.priority,
    },
  })

  return Response.json({
    success: true,
    data: serializeHospitalAdminNotification(notification),
  } satisfies ApiResponse)
}
