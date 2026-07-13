import type { NextRequest } from "next/server"

import { billingInvoiceInclude, billingPaymentInclude, billingOk, dateRange, decimal, ensureBillingPatient, fullName, serializeInvoiceList, serializePayment, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { PatientBillingStatement } from "@/types/billing"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const patient = await ensureBillingPatient(id, actor.facilityId)
    const params = request.nextUrl.searchParams
    const invoiceDate = dateRange(params, "createdAt")
    const paymentDate = dateRange(params, "paidAt")
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({ where: { patientId: id, facilityId: actor.facilityId, ...invoiceDate }, include: billingInvoiceInclude, orderBy: { createdAt: "asc" } }),
      prisma.payment.findMany({ where: { invoice: { patientId: id, facilityId: actor.facilityId }, ...paymentDate }, include: billingPaymentInclude, orderBy: { createdAt: "asc" } }),
    ])
    const data: PatientBillingStatement = {
      patient: { id: patient.id, patientNo: patient.patientNo, name: fullName(patient), phone: patient.phone, nhisNumber: patient.nhisNumber },
      dateFrom: params.get("dateFrom"),
      dateTo: params.get("dateTo"),
      invoices: invoices.map(serializeInvoiceList),
      payments: payments.map(serializePayment),
      totalBilled: invoices.filter((item) => !["CANCELLED", "VOID"].includes(item.status)).reduce((sum, item) => sum + decimal(item.totalAmount), 0),
      totalPaid: payments.filter((item) => item.status === "SUCCESSFUL").reduce((sum, item) => sum + decimal(item.amount), 0),
      totalReversed: payments.filter((item) => item.status === "REVERSED").reduce((sum, item) => sum + decimal(item.amount), 0),
      outstandingBalance: invoices.filter((item) => ["ISSUED", "PARTIALLY_PAID"].includes(item.status)).reduce((sum, item) => sum + decimal(item.balanceDue), 0),
    }
    return billingOk(data)
  })
}
