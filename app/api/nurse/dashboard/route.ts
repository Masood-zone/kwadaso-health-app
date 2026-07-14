import type { NextRequest } from "next/server"

import { loadNurseDashboard } from "@/lib/dashboard-loaders/nurse"
import { requireNurseApi } from "@/lib/nurse"
import { measureServerOperation, withServerTiming } from "@/lib/performance"
import type { ApiResponse } from "@/types"
import type { NurseDashboardSummary } from "@/types/nurse"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireNurseApi(request)
  if (response) return response

  try {
    const result = await measureServerOperation(
      "dashboard.nurse",
      () => loadNurseDashboard(staff!)
    )
    return withServerTiming(
      Response.json({ success: true, data: result.value } satisfies ApiResponse<NurseDashboardSummary>),
      "dashboard",
      result.durationMs
    )
  } catch (error) {
    console.error("Failed to load nurse dashboard", error)
    return Response.json(
      { success: false, message: "Nurse dashboard could not be loaded." } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
