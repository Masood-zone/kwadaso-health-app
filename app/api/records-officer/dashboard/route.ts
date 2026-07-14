import type { NextRequest } from "next/server"

import { loadRecordsOfficerDashboard } from "@/lib/dashboard-loaders/records-officer"
import { measureServerOperation, withServerTiming } from "@/lib/performance"
import { requireRecordsOfficerApi } from "@/lib/records-officer"
import type { ApiResponse } from "@/types"
import type { RecordsOfficerDashboardSummary } from "@/types/records-officer"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  try {
    const result = await measureServerOperation(
      "dashboard.records-officer",
      () => loadRecordsOfficerDashboard(staff!)
    )
    return withServerTiming(
      Response.json({ success: true, data: result.value } satisfies ApiResponse<RecordsOfficerDashboardSummary>),
      "dashboard",
      result.durationMs
    )
  } catch (error) {
    console.error("Failed to load records officer dashboard", error)
    return Response.json(
      { success: false, message: "Records officer dashboard could not be loaded." } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
