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

const notificationSchema = z.object({
  title: z.string().trim().min(2),
  message: z.string().trim().optional().nullable(),
  type: z.enum([
    "APPOINTMENT",
    "LAB_RESULT",
    "CRITICAL_ALERT",
    "REFERRAL",
    "MESSAGE",
    "SYSTEM",
    "BILLING",
    "STOCK",
  ]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
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

async function validateNotificationTargets({
  facilityId,
  targetRole,
  targetDepartmentId,
  recipientUserId,
}: {
  facilityId: string
  targetRole?: string | null
  targetDepartmentId?: string | null
  recipientUserId?: string | null
}) {
  if (targetRole && !assertNotSuperAdmin(targetRole as never)) {
    return "Notifications cannot target Super Admin."
  }

  const [department, recipient] = await Promise.all([
    targetDepartmentId
      ? prisma.department.findFirst({
          where: { id: targetDepartmentId, facilityId },
        })
      : Promise.resolve(null),
    recipientUserId
      ? prisma.user.findFirst({ where: { id: recipientUserId, facilityId } })
      : Promise.resolve(null),
  ])

  if (targetDepartmentId && !department) {
    return "Target department was not found in this facility."
  }
  if (recipientUserId && !recipient) {
    return "Recipient was not found in this facility."
  }

  return null
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const targetRole = searchParams.get("targetRole")
  const createdBy = searchParams.get("createdBy")

  const notifications = await prisma.notification.findMany({
    where: {
      facilityId: actor!.facilityId,
      ...(status ? { status: status as never } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(targetRole ? { targetRole: targetRole as never } : {}),
      ...(createdBy ? { createdById: createdBy } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { recipient: true, createdBy: true, targetDepartment: true },
  })

  return Response.json({
    success: true,
    data: notifications.map(serializeHospitalAdminNotification),
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const parsed = notificationSchema.safeParse(await request.json())
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

  const values = parsed.data
  const validationError = await validateNotificationTargets({
    facilityId: actor!.facilityId,
    targetRole: values.targetRole,
    targetDepartmentId: values.targetDepartmentId,
    recipientUserId: values.recipientUserId,
  })
  if (validationError) {
    return Response.json(
      { success: false, message: validationError },
      { status: 400 }
    )
  }

  const notification = await prisma.notification.create({
    data: {
      title: values.title,
      body: values.message || null,
      type: values.type,
      priority: values.priority,
      facilityId: actor!.facilityId,
      createdById: actor!.id,
      targetRole: values.targetRole || null,
      targetDepartmentId: values.targetDepartmentId || null,
      recipientId: values.recipientUserId || null,
      expiresAt: values.expiresAt ? new Date(values.expiresAt) : null,
    },
    include: { recipient: true, createdBy: true, targetDepartment: true },
  })

  await writeHospitalAdminAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "Notification",
    entityId: notification.id,
    description: `Created notification ${notification.title}`,
    after: {
      title: notification.title,
      type: notification.type,
      priority: notification.priority,
      targetRole: notification.targetRole,
      targetDepartmentId: notification.targetDepartmentId,
      recipientId: notification.recipientId,
    },
  })

  return Response.json(
    {
      success: true,
      data: serializeHospitalAdminNotification(notification),
    } satisfies ApiResponse,
    { status: 201 }
  )
}
