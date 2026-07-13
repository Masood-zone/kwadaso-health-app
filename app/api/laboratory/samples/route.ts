import { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import type { SampleStatus } from "@/lib/generated/prisma/enums"
import {
  laboratoryRequestScope,
  pageData,
  parseDateRange,
  parsePagination,
  requireLaboratoryApi,
  serializeLabSample,
  laboratorySampleInclude,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabSampleListItem, LaboratoryPage } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const params = request.nextUrl.searchParams
  const { page, pageSize, skip } = parsePagination(params)
  const search = params.get("search")?.trim()
  const status = params.get("status") as SampleStatus | null
  const where: Prisma.LabSampleWhereInput = {
    labRequest: laboratoryRequestScope(actor!.facilityId),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { sampleNo: { contains: search, mode: "insensitive" } },
            { labRequest: { requestNo: { contains: search, mode: "insensitive" } } },
            { labRequest: { patient: { firstName: { contains: search, mode: "insensitive" } } } },
            { labRequest: { patient: { lastName: { contains: search, mode: "insensitive" } } } },
            { labRequest: { patient: { patientNo: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...parseDateRange(params, "createdAt"),
  }
  const [rows, total] = await Promise.all([
    prisma.labSample.findMany({ where, include: laboratorySampleInclude, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.labSample.count({ where }),
  ])
  return Response.json({
    success: true,
    data: pageData(rows.map(serializeLabSample), total, page, pageSize),
  } satisfies ApiResponse<LaboratoryPage<LabSampleListItem>>)
}
