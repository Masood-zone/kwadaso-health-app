import type { NextRequest } from "next/server"

import { billingInvoiceInclude, billingOk, decimal, ensureBillingPatient, serializeInvoiceList, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { BillingClearance } from "@/types/billing"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    await ensureBillingPatient(id, actor.facilityId)
    const invoice = await prisma.invoice.findFirst({ where: { patientId: id, facilityId: actor.facilityId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, include: billingInvoiceInclude, orderBy: { createdAt: "desc" } })
    const data: BillingClearance = {
      activeInvoice: invoice ? serializeInvoiceList(invoice) : null,
      amountDue: invoice ? decimal(invoice.totalAmount) : 0,
      amountPaid: invoice ? decimal(invoice.amountPaid) : 0,
      balance: invoice ? decimal(invoice.balanceDue) : 0,
      cleared: !invoice || decimal(invoice.balanceDue) <= 0,
      notes: invoice ? "Outstanding billing is informational and must not block emergency care." : "No active outstanding invoice.",
    }
    return billingOk(data)
  })
}
