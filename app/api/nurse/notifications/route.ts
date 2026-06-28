import { NextRequest } from "next/server"

import { requireNurseApi, serializeNotification } from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response

  const notifications = await prisma.notification.findMany({
    where: {
      facilityId: actor!.facilityId,
      OR: [
        { recipientId: actor!.id },
        { targetRole: "NURSE" },
        { targetDepartmentId: actor!.departmentId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return Response.json({
    success: true,
    data: notifications.map(serializeNotification),
  } satisfies ApiResponse)
}
