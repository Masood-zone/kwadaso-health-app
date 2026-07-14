import type { NextRequest } from "next/server"

import { loadLaboratoryDashboard } from "@/lib/dashboard-loaders/laboratory"
import { requireLaboratoryApi } from "@/lib/laboratory"
import { measureServerOperation, withServerTiming } from "@/lib/performance"
import type { ApiResponse } from "@/types"
import type { LaboratoryDashboardSummary } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireLaboratoryApi(request)
  if (response) return response

  try {
    const result = await measureServerOperation(
      "dashboard.laboratory",
      () => loadLaboratoryDashboard(staff!)
    )
    return withServerTiming(
      Response.json({ success: true, data: result.value } satisfies ApiResponse<LaboratoryDashboardSummary>),
      "dashboard",
      result.durationMs
    )
  } catch (error) {
    console.error("Failed to load laboratory dashboard", error)
    return Response.json(
      { success: false, message: "Laboratory dashboard could not be loaded." } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
