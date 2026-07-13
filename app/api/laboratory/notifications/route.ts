import { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import { pageData, parsePagination, requireLaboratoryApi, serializeLaboratoryNotification } from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LaboratoryNotificationItem, LaboratoryPage } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { page, pageSize, skip } = parsePagination(request.nextUrl.searchParams)
  const statusParam = request.nextUrl.searchParams.get("status")
  const status = (["UNREAD", "READ", "ARCHIVED"] as const).find((item) => item === statusParam)
  const where: Prisma.NotificationWhereInput = {
      facilityId: actor!.facilityId,
      type: { in: ["LAB_RESULT", "CRITICAL_ALERT"] },
      ...(status ? { status: status as "UNREAD" | "READ" | "ARCHIVED" } : {}),
      OR: [
        { recipientId: actor!.id },
        { targetRole: "LAB_TECHNICIAN" },
        ...(actor!.departmentId ? [{ targetDepartmentId: actor!.departmentId }] : []),
      ],
    }
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.notification.count({ where }),
  ])
  return Response.json({ success: true, data: pageData(notifications.map(serializeLaboratoryNotification), total, page, pageSize) } satisfies ApiResponse<LaboratoryPage<LaboratoryNotificationItem>>)
}
