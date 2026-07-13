import type { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import { billingPaymentInclude, billingOk, dateRange, invoiceScope, serializePayment, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const where: Prisma.PaymentWhereInput = { invoice: invoiceScope(actor.facilityId), method: { in: ["NHIS", "WAIVER"] }, ...dateRange(request.nextUrl.searchParams, "paidAt") }
    const payments = await prisma.payment.findMany({ where, include: billingPaymentInclude, orderBy: { paidAt: "desc" }, take: 250 })
    return billingOk({
      nhis: payments.filter((item) => item.method === "NHIS").map(serializePayment),
      waivers: payments.filter((item) => item.method === "WAIVER").map(serializePayment),
    })
  })
}
