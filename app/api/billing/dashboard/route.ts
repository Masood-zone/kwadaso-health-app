import type { NextRequest } from "next/server"

import { billingOk, withBilling } from "@/lib/billing"
import { loadBillingDashboard } from "@/lib/dashboard-loaders/billing"
import { measureServerOperation, withServerTiming } from "@/lib/performance"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const result = await measureServerOperation(
      "dashboard.billing",
      () => loadBillingDashboard(actor)
    )
    return withServerTiming(
      billingOk(result.value),
      "dashboard",
      result.durationMs
    )
  })
}
