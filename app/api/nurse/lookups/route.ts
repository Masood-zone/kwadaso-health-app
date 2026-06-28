import { NextRequest } from "next/server"

import { getNurseLookups, requireNurseApi } from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response

  const departments = await prisma.department.findMany({
    where: { facilityId: actor!.facilityId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  })

  return Response.json({
    success: true,
    data: { ...getNurseLookups(), departments },
  } satisfies ApiResponse)
}
