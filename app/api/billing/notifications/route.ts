import type { NextRequest } from "next/server"

import { billingNotificationWhere, billingOk, pageData, parsePagination, serializeBillingNotification, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const params = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(params)
    const status = params.get("status")
    const where = { ...billingNotificationWhere(actor), ...(status ? { status: status as never } : {}) }
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.notification.count({ where }),
    ])
    return billingOk(pageData(rows.map(serializeBillingNotification), total, page, pageSize))
  })
}
