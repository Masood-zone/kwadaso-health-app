import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { getDepartmentActivity } from "@/lib/hospital-admin/queries"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireRoleApi(request, ["HOSPITAL_ADMIN"])
  if (response) return response

  try {
    const data = await getDepartmentActivity(staff!.facilityId)
    return Response.json({ success: true, data } satisfies ApiResponse)
  } catch (error) {
    console.error("Failed to load department activity", error)
    return Response.json(
      { success: false, message: "Department activity could not be loaded." },
      { status: 500 }
    )
  }
}
