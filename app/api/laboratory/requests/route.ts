import { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import type { LabPriority, LabRequestStatus } from "@/lib/generated/prisma/enums"
import {
  laboratoryRequestScope,
  pageData,
  parseDateRange,
  parsePagination,
  requireLaboratoryApi,
  serializeLabRequestQueueItem,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabRequestQueueItem, LaboratoryPage } from "@/types/laboratory"

const defaultStatuses: LabRequestStatus[] = ["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "PARTIAL_RESULT"]

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const params = request.nextUrl.searchParams
  const { page, pageSize, skip } = parsePagination(params)
  const search = params.get("search")?.trim()
  const requestNo = params.get("requestNo")?.trim()
  const priority = params.get("priority") as LabPriority | null
  const status = params.get("status") as LabRequestStatus | null
  const testId = params.get("testId")
  const clinicianId = params.get("clinicianId")
  const where: Prisma.LabRequestWhereInput = {
    ...laboratoryRequestScope(actor!.facilityId),
    ...(search
      ? {
          OR: [
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
            { patient: { patientNo: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(requestNo ? { requestNo: { contains: requestNo, mode: "insensitive" } } : {}),
    ...(priority ? { priority } : {}),
    status: status ?? { in: defaultStatuses },
    ...(testId ? { tests: { some: { testId } } } : {}),
    ...(clinicianId ? { requestedById: clinicianId } : {}),
    ...parseDateRange(params, "requestedAt"),
  }
  const [rows, total] = await Promise.all([
    prisma.labRequest.findMany({
      where,
      include: { patient: true, requestedBy: true, tests: { include: { test: true } } },
      orderBy: [{ priority: "desc" }, { requestedAt: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.labRequest.count({ where }),
  ])
  return Response.json({
    success: true,
    data: pageData(rows.map(serializeLabRequestQueueItem), total, page, pageSize),
  } satisfies ApiResponse<LaboratoryPage<LabRequestQueueItem>>)
}
