import type { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import { billingInvoiceInclude, billingPaymentInclude, billingOk, dateRange, decimal, invoiceScope, serializeInvoiceList, serializePayment, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { BillingReportSummary } from "@/types/billing"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const params = request.nextUrl.searchParams
    const departmentId = params.get("departmentId")
    const method = params.get("paymentMethod")
    const status = params.get("invoiceStatus")
    const officer = params.get("billingOfficerId")
    const serviceType = params.get("serviceType")
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      ...invoiceScope(actor.facilityId),
      ...dateRange(params, "createdAt"),
      ...(departmentId ? { encounter: { departmentId } } : {}),
      ...(status ? { status: status as never } : {}),
      ...(serviceType ? { items: { some: { itemType: serviceType } } } : {}),
    }
    const paymentWhere: Prisma.PaymentWhereInput = {
      invoice: { ...invoiceScope(actor.facilityId), ...(departmentId ? { encounter: { departmentId } } : {}) },
      ...dateRange(params, "paidAt"),
      ...(method ? { method: method as never } : {}),
      ...(officer ? { receivedById: officer } : {}),
    }
    const [invoices, payments, exports] = await Promise.all([
      prisma.invoice.findMany({ where: invoiceWhere, include: billingInvoiceInclude, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.payment.findMany({ where: paymentWhere, include: billingPaymentInclude, orderBy: { paidAt: "desc" }, take: 500 }),
      prisma.reportExport.findMany({ where: { facilityId: actor.facilityId, type: "FINANCIAL" }, include: { generatedBy: true }, orderBy: { generatedAt: "desc" }, take: 25 }),
    ])
    const validInvoices = invoices.filter((item) => !["CANCELLED", "VOID"].includes(item.status))
    const successful = payments.filter((item) => item.status === "SUCCESSFUL")
    const reversed = payments.filter((item) => item.status === "REVERSED")
    const methodMap = new Map<string, number>()
    const departmentMap = new Map<string, number>()
    const serviceMap = new Map<string, number>()
    for (const payment of successful) methodMap.set(payment.method, (methodMap.get(payment.method) ?? 0) + decimal(payment.amount))
    for (const invoice of validInvoices) {
      const department = invoice.encounter?.department.name ?? "General Billing"
      departmentMap.set(department, (departmentMap.get(department) ?? 0) + decimal(invoice.totalAmount))
      for (const item of invoice.items) serviceMap.set(item.itemType ?? "OTHER", (serviceMap.get(item.itemType ?? "OTHER") ?? 0) + decimal(item.totalPrice))
    }
    const totalBilled = validInvoices.reduce((sum, item) => sum + decimal(item.totalAmount), 0)
    const data: BillingReportSummary = {
      totalBilled,
      totalCollected: successful.reduce((sum, item) => sum + decimal(item.amount), 0),
      outstandingBalance: validInvoices.reduce((sum, item) => sum + decimal(item.balanceDue), 0),
      reversedAmount: reversed.reduce((sum, item) => sum + decimal(item.amount), 0),
      invoiceCount: validInvoices.length,
      paymentCount: successful.length,
      averageInvoiceValue: validInvoices.length ? totalBilled / validInvoices.length : 0,
      invoices: invoices.map(serializeInvoiceList),
      payments: payments.map(serializePayment),
      byMethod: [...methodMap].map(([label, amount]) => ({ label, amount })),
      byDepartment: [...departmentMap].map(([label, amount]) => ({ label, amount })),
      byServiceType: [...serviceMap].map(([label, amount]) => ({ label, amount })),
      exports: exports.map((item) => ({ id: item.id, title: item.title, status: item.status, generatedAt: item.generatedAt.toISOString(), generatedByName: item.generatedBy?.name ?? null })),
    }
    return billingOk(data)
  })
}
