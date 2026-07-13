import type { NextRequest } from "next/server"

import { billingPaymentInclude, billingOk, decimal, invoiceScope, serializePayment, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { DailyCollectionSummary } from "@/types/billing"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const selected = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
    const start = new Date(`${selected}T00:00:00.000Z`)
    const end = new Date(`${selected}T23:59:59.999Z`)
    if (Number.isNaN(start.getTime())) return Response.json({ success: false, message: "Collection date is invalid.", code: "INVALID_DATE" }, { status: 400 })
    const scope = invoiceScope(actor.facilityId)
    const [payments, invoiceCount] = await Promise.all([
      prisma.payment.findMany({ where: { invoice: scope, paidAt: { gte: start, lte: end }, status: { in: ["SUCCESSFUL", "REVERSED"] } }, include: billingPaymentInclude, orderBy: { paidAt: "desc" } }),
      prisma.invoice.count({ where: { ...scope, createdAt: { gte: start, lte: end } } }),
    ])
    const successful = payments.filter((item) => item.status === "SUCCESSFUL")
    const methods = new Map<string, { amount: number; count: number }>()
    const officers = new Map<string, { amount: number; count: number }>()
    const departments = new Map<string, { amount: number; count: number }>()
    const hourly = new Map<string, number>()
    for (const payment of successful) {
      const amount = decimal(payment.amount)
      const method = methods.get(payment.method) ?? { amount: 0, count: 0 }
      methods.set(payment.method, { amount: method.amount + amount, count: method.count + 1 })
      const officerName = payment.receivedBy?.name ?? "Unassigned"
      const officer = officers.get(officerName) ?? { amount: 0, count: 0 }
      officers.set(officerName, { amount: officer.amount + amount, count: officer.count + 1 })
      const departmentName = payment.invoice.encounter?.department.name ?? "General Billing"
      const department = departments.get(departmentName) ?? { amount: 0, count: 0 }
      departments.set(departmentName, { amount: department.amount + amount, count: department.count + 1 })
      const hour = `${String(payment.paidAt?.getHours() ?? 0).padStart(2, "0")}:00`
      hourly.set(hour, (hourly.get(hour) ?? 0) + amount)
    }
    const data: DailyCollectionSummary = {
      date: selected,
      totalCollected: successful.reduce((sum, item) => sum + decimal(item.amount), 0),
      invoiceCount,
      reversedAmount: payments.filter((item) => item.status === "REVERSED").reduce((sum, item) => sum + decimal(item.amount), 0),
      byMethod: [...methods].map(([method, value]) => ({ method: method as never, ...value })),
      byOfficer: [...officers].map(([officer, value]) => ({ officer, ...value })),
      byDepartment: [...departments].map(([department, value]) => ({ department, ...value })),
      hourly: [...hourly].map(([hour, amount]) => ({ hour, amount })).sort((a, b) => a.hour.localeCompare(b.hour)),
      transactions: payments.map(serializePayment),
    }
    return billingOk(data)
  })
}
