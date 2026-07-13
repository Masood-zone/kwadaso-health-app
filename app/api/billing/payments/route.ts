import type { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import { billingPaymentInclude, billingOk, dateRange, invoiceScope, pageData, parsePagination, serializePayment, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const params = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(params)
    const search = params.get("search")?.trim()
    const method = params.get("method")
    const status = params.get("status")
    const receivedById = params.get("receivedById")
    const patient = params.get("patient")?.trim()
    const where: Prisma.PaymentWhereInput = {
      invoice: invoiceScope(actor.facilityId),
      ...dateRange(params, "paidAt"),
      ...(method ? { method: method as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(receivedById ? { receivedById } : {}),
      ...(search || patient ? { OR: [
        ...(search ? [
          { receiptNo: { contains: search, mode: "insensitive" as const } },
          { invoice: { invoiceNo: { contains: search, mode: "insensitive" as const } } },
          { reference: { contains: search, mode: "insensitive" as const } },
        ] : []),
        { invoice: { patient: { OR: [
          { patientNo: { contains: patient || search, mode: "insensitive" } },
          { firstName: { contains: patient || search, mode: "insensitive" } },
          { lastName: { contains: patient || search, mode: "insensitive" } },
        ] } } },
      ] } : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({ where, include: billingPaymentInclude, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.payment.count({ where }),
    ])
    return billingOk(pageData(rows.map(serializePayment), total, page, pageSize))
  })
}
