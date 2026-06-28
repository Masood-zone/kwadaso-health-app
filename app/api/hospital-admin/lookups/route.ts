import { NextRequest } from "next/server"

import {
  getHospitalAdminLookups,
  requireHospitalAdminApi,
} from "@/lib/hospital-admin"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { response } = await requireHospitalAdminApi(request)
  if (response) return response

  return Response.json({
    success: true,
    data: getHospitalAdminLookups(),
  } satisfies ApiResponse)
}
