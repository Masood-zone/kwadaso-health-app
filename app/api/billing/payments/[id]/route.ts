import type { NextRequest } from "next/server"

import { billingOk, ensureBillingPayment, serializePayment, withBilling } from "@/lib/billing"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    return billingOk(serializePayment(await ensureBillingPayment(id, actor.facilityId)))
  })
}
