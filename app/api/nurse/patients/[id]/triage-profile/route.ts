import { NextRequest } from "next/server"

import { getPatientTriageProfile, requireNurseApi } from "@/lib/nurse"
import type { ApiResponse } from "@/types"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id } = await context.params
  const profile = await getPatientTriageProfile(id, actor!.facilityId)

  if (!profile) {
    return Response.json(
      { success: false, message: "Patient was not found in this facility." },
      { status: 404 }
    )
  }

  return Response.json({ success: true, data: profile } satisfies ApiResponse)
}
