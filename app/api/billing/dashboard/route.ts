import type { NextRequest } from "next/server"

import {
  billingInvoiceInclude,
  billingPaymentInclude,
  billingOk,
  decimal,
  invoiceScope,
  serializeInvoiceList,
  serializePayment,
  withBilling,
} from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { BillingDashboardSummary } from "@/types/billing"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const trendStart = new Date(start)
    trendStart.setDate(trendStart.getDate() - 6)
    const scope = invoiceScope(actor.facilityId)
    const [
      facility,
      invoicesToday,
      paymentsToday,
      outstanding,
      paidInvoices,
      partiallyPaidInvoices,
      unpaidInvoices,
      reversedPayments,
      paymentMethods,
      recentInvoices,
      recentPayments,
      trendInvoices,
      trendPayments,
      overdueCount,
    ] = await Promise.all([
      prisma.facility.findUnique({ where: { id: actor.facilityId } }),
      prisma.invoice.findMany({ where: { ...scope, createdAt: { gte: start, lte: end } } }),
      prisma.payment.findMany({
        where: {
          invoice: scope,
          status: "SUCCESSFUL",
          paidAt: { gte: start, lte: end },
        },
      }),
      prisma.invoice.aggregate({
        where: { ...scope, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        _sum: { balanceDue: true },
      }),
      prisma.invoice.count({ where: { ...scope, status: "PAID" } }),
      prisma.invoice.count({ where: { ...scope, status: "PARTIALLY_PAID" } }),
      prisma.invoice.count({ where: { ...scope, status: "ISSUED" } }),
      prisma.payment.count({ where: { invoice: scope, status: "REVERSED" } }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { invoice: scope, status: "SUCCESSFUL", paidAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({ where: scope, include: billingInvoiceInclude, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.payment.findMany({ where: { invoice: scope }, include: billingPaymentInclude, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.invoice.findMany({ where: { ...scope, createdAt: { gte: trendStart } }, select: { createdAt: true, totalAmount: true } }),
      prisma.payment.findMany({ where: { invoice: scope, status: "SUCCESSFUL", paidAt: { gte: trendStart } }, select: { paidAt: true, amount: true } }),
      prisma.invoice.count({ where: { ...scope, status: { in: ["ISSUED", "PARTIALLY_PAID"] }, issuedAt: { lt: new Date(Date.now() - 30 * 86400000) } } }),
    ])
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(trendStart)
      day.setDate(day.getDate() + index)
      const key = day.toISOString().slice(0, 10)
      return {
        date: key,
        billed: trendInvoices.filter((item) => item.createdAt.toISOString().slice(0, 10) === key).reduce((sum, item) => sum + decimal(item.totalAmount), 0),
        collected: trendPayments.filter((item) => item.paidAt?.toISOString().slice(0, 10) === key).reduce((sum, item) => sum + decimal(item.amount), 0),
      }
    })
    const data: BillingDashboardSummary = {
      facilityName: facility?.name ?? "Kwadaso HealthLink Integrated Platform",
      invoicesCreatedToday: invoicesToday.length,
      amountBilledToday: invoicesToday.reduce((sum, item) => sum + decimal(item.totalAmount), 0),
      amountCollectedToday: paymentsToday.reduce((sum, item) => sum + decimal(item.amount), 0),
      outstandingBalance: decimal(outstanding._sum.balanceDue),
      paidInvoices,
      partiallyPaidInvoices,
      unpaidInvoices,
      reversedPayments,
      paymentMethods: paymentMethods.map((item) => ({ method: item.method, amount: decimal(item._sum.amount), count: item._count._all })),
      collectionTrend: days,
      recentInvoices: recentInvoices.map(serializeInvoiceList),
      recentPayments: recentPayments.map(serializePayment),
      alerts: [
        ...(overdueCount ? [{ id: "overdue", title: "Outstanding over 30 days", detail: `${overdueCount} invoice${overdueCount === 1 ? "" : "s"} require follow-up.`, tone: "red" as const }] : []),
        ...(!paymentsToday.length ? [{ id: "collections", title: "No collections today", detail: "No successful payment has been recorded today.", tone: "orange" as const }] : []),
      ],
    }
    return billingOk(data)
  })
}
