import { NextRequest } from "next/server"

import { requireNurseApi, serializeImmunization } from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get("search")?.trim()
  const vaccineName = searchParams.get("vaccineName")?.trim()
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const nextDueFrom = searchParams.get("nextDueFrom")
  const nextDueTo = searchParams.get("nextDueTo")
  const administeredById = searchParams.get("administeredById")

  const records = await prisma.immunizationRecord.findMany({
    where: {
      patient: { registeredFacilityId: actor!.facilityId },
      ...(vaccineName
        ? { vaccineName: { contains: vaccineName, mode: "insensitive" } }
        : {}),
      ...(administeredById ? { administeredById } : {}),
      ...(dateFrom || dateTo
        ? {
            administeredAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(nextDueFrom || nextDueTo
        ? {
            nextDueAt: {
              ...(nextDueFrom ? { gte: new Date(nextDueFrom) } : {}),
              ...(nextDueTo ? { lte: new Date(nextDueTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { patient: { firstName: { contains: search, mode: "insensitive" } } },
              { patient: { lastName: { contains: search, mode: "insensitive" } } },
              { patient: { patientNo: { contains: search, mode: "insensitive" } } },
              { vaccineName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { administeredAt: "desc" },
    include: { patient: true, administeredBy: true },
  })

  return Response.json({
    success: true,
    data: records.map(serializeImmunization),
  } satisfies ApiResponse)
}
