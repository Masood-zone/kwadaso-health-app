import { NextRequest } from "next/server"

import {
  requireHospitalAdminApi,
  serializeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const actorId = searchParams.get("actorId")
  const action = searchParams.get("action")
  const entityType = searchParams.get("entityType")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const search = searchParams.get("search")?.trim()

  const logs = await prisma.auditLog.findMany({
    where: {
      actor: { facilityId: actor!.facilityId },
      ...(actorId ? { actorId } : {}),
      ...(action ? { action: action as never } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: "insensitive" } },
              { entityType: { contains: search, mode: "insensitive" } },
              { entityId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: true },
  })

  return Response.json({
    success: true,
    data: logs.map(serializeHospitalAdminAuditLog),
  } satisfies ApiResponse)
}
