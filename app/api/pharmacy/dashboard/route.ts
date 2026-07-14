import type { NextRequest } from "next/server"

import { loadPharmacyDashboard } from "@/lib/dashboard-loaders/pharmacy"
import { measureServerOperation, withServerTiming } from "@/lib/performance"
import { pharmacyOk, withPharmacy } from "@/lib/pharmacy"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const result = await measureServerOperation(
      "dashboard.pharmacy",
      () => loadPharmacyDashboard(actor)
    )
    return withServerTiming(
      pharmacyOk(result.value),
      "dashboard",
      result.durationMs
    )
  })
}
