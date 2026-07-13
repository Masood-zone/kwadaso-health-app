import { NextRequest } from "next/server"

import {
  getLaboratoryLookups,
  hasLaboratoryPermission,
  requireLaboratoryApi,
  serializeCatalog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LaboratoryLookups } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const [tests, clinicians, canManageCatalog] = await Promise.all([
    prisma.labTestCatalog.findMany({
      where: { facilityId: actor!.facilityId },
      include: { parameterDefinitions: true, _count: { select: { requestTests: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { facilityId: actor!.facilityId, defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] }, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    hasLaboratoryPermission(actor!, "laboratory.manage"),
  ])
  const data: LaboratoryLookups = {
    ...getLaboratoryLookups(),
    tests: tests.map(serializeCatalog),
    clinicians,
    canManageCatalog,
  }
  return Response.json({ success: true, data } satisfies ApiResponse<LaboratoryLookups>)
}
