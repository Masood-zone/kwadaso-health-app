import { NextRequest } from "next/server"

import {
  requireRecordsOfficerApi,
  serializeVisitHistory,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id } = await context.params
  const patient = await prisma.patient.findFirst({
    where: { id, registeredFacilityId: actor!.facilityId },
  })
  if (!patient) return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })

  const encounters = await prisma.encounter.findMany({
    where: { patientId: id, facilityId: actor!.facilityId },
    orderBy: { startedAt: "desc" },
    include: { department: true, clinician: true },
  })

  return Response.json({ success: true, data: encounters.map(serializeVisitHistory) } satisfies ApiResponse)
}
