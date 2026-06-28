import { NextRequest } from "next/server"

import { getRecordsLookups, requireRecordsOfficerApi } from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const [departments, clinicians] = await Promise.all([
    prisma.department.findMany({
      where: { facilityId: actor!.facilityId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.user.findMany({
      where: {
        facilityId: actor!.facilityId,
        status: "ACTIVE",
        defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT", "NURSE"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, defaultRole: true },
    }),
  ])

  return Response.json({
    success: true,
    data: {
      ...getRecordsLookups(),
      departments,
      clinicians: clinicians.map((clinician) => ({
        id: clinician.id,
        name: clinician.name,
        role: clinician.defaultRole,
      })),
    },
  } satisfies ApiResponse)
}
