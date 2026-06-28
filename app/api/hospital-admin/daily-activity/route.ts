import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { getDailyHospitalActivity } from "@/lib/hospital-admin/queries"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireRoleApi(request, ["HOSPITAL_ADMIN"])
  if (response) return response

  try {
    const data = await getDailyHospitalActivity(staff!.facilityId)
    return Response.json({ success: true, data } satisfies ApiResponse)
  } catch (error) {
    console.error("Failed to load daily hospital activity", error)
    return Response.json(
      {
        success: false,
        message: "Daily hospital activity could not be loaded.",
      },
      { status: 500 }
    )
  }
}
