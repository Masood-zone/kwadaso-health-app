import type { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { loadHospitalAdminDashboard } from "@/lib/dashboard-loaders/hospital-admin"
import { measureServerOperation, withServerTiming } from "@/lib/performance"
import type { ApiResponse } from "@/types"
import type { HospitalAdminDashboardData } from "@/types/dashboard"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireRoleApi(request, ["HOSPITAL_ADMIN"])
  if (response) return response

  try {
    const result = await measureServerOperation(
      "dashboard.hospital-admin",
      () => loadHospitalAdminDashboard(staff!)
    )
    return withServerTiming(
      Response.json({ success: true, data: result.value } satisfies ApiResponse<HospitalAdminDashboardData>),
      "dashboard",
      result.durationMs
    )
  } catch (error) {
    console.error("Failed to load hospital admin dashboard", error)
    return Response.json(
      { success: false, message: "Hospital admin dashboard could not be loaded." } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
