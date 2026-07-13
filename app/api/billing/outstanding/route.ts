import type { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import { billingInvoiceInclude, billingOk, dateRange, decimal, invoiceScope, pageData, parsePagination, serializeInvoiceList, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { OutstandingBalanceItem } from "@/types/billing"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const params = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(params)
    const search = params.get("search")?.trim()
    const days = Number(params.get("days")) || 0
    const minAmount = Number(params.get("minAmount")) || 0
    const departmentId = params.get("departmentId")
    const nhis = params.get("nhis")
    const where: Prisma.InvoiceWhereInput = {
      ...invoiceScope(actor.facilityId),
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      balanceDue: { gt: Math.max(0, minAmount) },
      ...dateRange(params, "issuedAt"),
      ...(days ? { issuedAt: { lt: new Date(Date.now() - days * 86400000) } } : {}),
      ...(departmentId ? { encounter: { departmentId } } : {}),
      ...(nhis === "true" ? { patient: { nhisNumber: { not: null } } } : {}),
      ...(nhis === "false" ? { patient: { nhisNumber: null } } : {}),
      ...(search ? { OR: [
        { invoiceNo: { contains: search, mode: "insensitive" } },
        { patient: { patientNo: { contains: search, mode: "insensitive" } } },
        { patient: { firstName: { contains: search, mode: "insensitive" } } },
        { patient: { lastName: { contains: search, mode: "insensitive" } } },
      ] } : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({ where, include: billingInvoiceInclude, orderBy: [{ issuedAt: "asc" }, { createdAt: "asc" }], skip, take: pageSize }),
      prisma.invoice.count({ where }),
    ])
    const items: OutstandingBalanceItem[] = rows.map((item) => {
      const invoiceDate = item.issuedAt ?? item.createdAt
      const daysOutstanding = Math.max(0, Math.floor((Date.now() - invoiceDate.getTime()) / 86400000))
      const lastPayment = item.payments.filter((payment) => payment.paidAt).sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0))[0]
      return {
        ...serializeInvoiceList(item),
        invoiceDate: invoiceDate.toISOString(),
        daysOutstanding,
        lastPaymentAt: lastPayment?.paidAt?.toISOString() ?? null,
        agingBand: daysOutstanding > 30 ? "OVERDUE" : decimal(item.balanceDue) >= 5000 ? "HIGH_VALUE" : "RECENT",
        nhisStatus: item.patient.nhisNumber ? "NHIS" : "SELF_PAY",
      }
    })
    return billingOk(pageData(items, total, page, pageSize))
  })
}
