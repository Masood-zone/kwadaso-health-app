import { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import type { LabResultStatus } from "@/lib/generated/prisma/enums"
import {
  laboratoryResultInclude,
  laboratoryResultScope,
  pageData,
  parseDateRange,
  parsePagination,
  requireLaboratoryApi,
  serializeLabResultList,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabResultListItem, LaboratoryPage } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const params = request.nextUrl.searchParams
  const { page, pageSize, skip } = parsePagination(params)
  const search = params.get("search")?.trim()
  const status = params.get("status") as LabResultStatus | null
  const testId = params.get("testId")
  const clinicianId = params.get("clinicianId")
  const abnormal = params.get("abnormal")
  const critical = params.get("critical")
  const where: Prisma.LabResultWhereInput = {
    ...laboratoryResultScope(actor!.facilityId),
    ...(status ? { status } : {}),
    ...(testId ? { testId } : {}),
    ...(clinicianId ? { requestTest: { labRequest: { requestedById: clinicianId } } } : {}),
    ...(abnormal ? { abnormalFlag: abnormal === "true" } : {}),
    ...(critical ? { criticalFlag: critical === "true" } : {}),
    ...(search
      ? {
          OR: [
            { resultNo: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
            { patient: { patientNo: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...parseDateRange(params, "createdAt"),
  }
  const [rows, total] = await Promise.all([
    prisma.labResult.findMany({ where, include: laboratoryResultInclude, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.labResult.count({ where }),
  ])
  const criticalAlerts = rows.length
    ? await prisma.notification.findMany({
        where: {
          facilityId: actor!.facilityId,
          type: "CRITICAL_ALERT",
          entityType: "LabResult",
          entityId: { in: rows.map((row) => row.id) },
          recipientId: { not: null },
        },
        orderBy: { createdAt: "desc" },
      })
    : []
  const alertByResult = new Map(
    criticalAlerts.map((alert) => [
      alert.entityId,
      {
        sent: true,
        acknowledged: alert.status === "READ" || alert.status === "ARCHIVED",
        sentAt: alert.createdAt.toISOString(),
      },
    ])
  )
  return Response.json({
    success: true,
    data: pageData(
      rows.map((row) => ({
        ...serializeLabResultList(row),
        criticalAlert: alertByResult.get(row.id) ?? {
          sent: false,
          acknowledged: false,
          sentAt: null,
        },
      })),
      total,
      page,
      pageSize
    ),
  } satisfies ApiResponse<LaboratoryPage<LabResultListItem>>)
}
