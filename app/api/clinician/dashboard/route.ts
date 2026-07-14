import type { NextRequest } from "next/server"

import { loadClinicianDashboard } from "@/lib/dashboard-loaders/clinician"
import { ok, withClinician } from "@/lib/clinician-route"
import { measureServerOperation, withServerTiming } from "@/lib/performance"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const result = await measureServerOperation(
      "dashboard.clinician",
      () => loadClinicianDashboard(actor)
    )
    return withServerTiming(ok(result.value), "dashboard", result.durationMs)
  })
}
