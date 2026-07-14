import type { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { loadSuperAdminDashboardSummary } from "@/lib/dashboard-loaders/super-admin"
import { measureServerOperation, withServerTiming } from "@/lib/performance"
import type { ApiResponse } from "@/types"
import type { SuperAdminDashboardSummary } from "@/types/dashboard"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  try {
    const result = await measureServerOperation(
      "dashboard.super-admin",
      () => loadSuperAdminDashboardSummary(staff!)
    )
    return withServerTiming(
      Response.json({ success: true, data: result.value } satisfies ApiResponse<SuperAdminDashboardSummary>),
      "dashboard",
      result.durationMs
    )
  } catch (error) {
    console.error("Failed to load super admin dashboard", error)
    return Response.json(
      { success: false, message: "Super admin dashboard could not be loaded." } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
