import type { AuthenticatedStaff } from "@/lib/auth-session"
import {
  billingInvoiceInclude,
  billingPaymentInclude,
  decimal,
  serializeInvoiceList,
  serializePayment,
} from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { PaymentMethod } from "@/lib/generated/prisma/enums"
import type { BillingDashboardSummary } from "@/types/billing"

type BillingAnalyticsRow = {
  invoicesCreatedToday: bigint
  amountBilledToday: unknown
  amountCollectedToday: unknown
  outstandingBalance: unknown
  paidInvoices: bigint
  partiallyPaidInvoices: bigint
  unpaidInvoices: bigint
  reversedPayments: bigint
  overdueCount: bigint
  paymentMethods: Array<{ method: string; amount: number | string; count: number }>
  collectionTrend: Array<{ date: string; billed: number | string; collected: number | string }>
}

export async function loadBillingDashboard(
  actor: AuthenticatedStaff,
  now = new Date()
): Promise<BillingDashboardSummary> {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const trendStart = new Date(start)
  trendStart.setDate(trendStart.getDate() - 6)
  const overdueBefore = new Date(now.getTime() - 30 * 86_400_000)
  const facilityId = actor.facilityId

  const [analyticsRows, recentInvoices, recentPayments] = await Promise.all([
    prisma.$queryRaw<BillingAnalyticsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Invoice"
          WHERE "facilityId" = ${facilityId}
            AND "createdAt" >= ${start} AND "createdAt" < ${end}) AS "invoicesCreatedToday",
        (SELECT COALESCE(SUM("totalAmount"), 0) FROM "Invoice"
          WHERE "facilityId" = ${facilityId}
            AND "createdAt" >= ${start} AND "createdAt" < ${end}) AS "amountBilledToday",
        (SELECT COALESCE(SUM(p."amount"), 0) FROM "Payment" p
          JOIN "Invoice" i ON i."id" = p."invoiceId"
          WHERE i."facilityId" = ${facilityId}
            AND p."status" = 'SUCCESSFUL'
            AND p."paidAt" >= ${start} AND p."paidAt" < ${end}) AS "amountCollectedToday",
        (SELECT COALESCE(SUM("balanceDue"), 0) FROM "Invoice"
          WHERE "facilityId" = ${facilityId}
            AND "status" IN ('ISSUED', 'PARTIALLY_PAID')) AS "outstandingBalance",
        (SELECT COUNT(*) FROM "Invoice" WHERE "facilityId" = ${facilityId} AND "status" = 'PAID') AS "paidInvoices",
        (SELECT COUNT(*) FROM "Invoice" WHERE "facilityId" = ${facilityId} AND "status" = 'PARTIALLY_PAID') AS "partiallyPaidInvoices",
        (SELECT COUNT(*) FROM "Invoice" WHERE "facilityId" = ${facilityId} AND "status" = 'ISSUED') AS "unpaidInvoices",
        (SELECT COUNT(*) FROM "Payment" p JOIN "Invoice" i ON i."id" = p."invoiceId"
          WHERE i."facilityId" = ${facilityId} AND p."status" = 'REVERSED') AS "reversedPayments",
        (SELECT COUNT(*) FROM "Invoice"
          WHERE "facilityId" = ${facilityId}
            AND "status" IN ('ISSUED', 'PARTIALLY_PAID')
            AND "issuedAt" < ${overdueBefore}) AS "overdueCount",
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'method', methods.method,
            'amount', methods.amount,
            'count', methods.count
          ) ORDER BY methods.method)
          FROM (
            SELECT p."method"::text AS method, COALESCE(SUM(p."amount"), 0) AS amount, COUNT(*)::int AS count
            FROM "Payment" p
            JOIN "Invoice" i ON i."id" = p."invoiceId"
            WHERE i."facilityId" = ${facilityId}
              AND p."status" = 'SUCCESSFUL'
              AND p."paidAt" >= ${start} AND p."paidAt" < ${end}
            GROUP BY p."method"
          ) methods
        ), '[]'::jsonb) AS "paymentMethods",
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'date', to_char(day, 'YYYY-MM-DD'),
            'billed', COALESCE((SELECT SUM(i."totalAmount") FROM "Invoice" i
              WHERE i."facilityId" = ${facilityId}
                AND i."createdAt" >= day AND i."createdAt" < day + interval '1 day'), 0),
            'collected', COALESCE((SELECT SUM(p."amount") FROM "Payment" p
              JOIN "Invoice" i ON i."id" = p."invoiceId"
              WHERE i."facilityId" = ${facilityId}
                AND p."status" = 'SUCCESSFUL'
                AND p."paidAt" >= day AND p."paidAt" < day + interval '1 day'), 0)
          ) ORDER BY day)
          FROM generate_series(${trendStart}::timestamp, ${start}::timestamp, interval '1 day') day
        ), '[]'::jsonb) AS "collectionTrend"
    `,
    prisma.invoice.findMany({
      where: { facilityId },
      include: billingInvoiceInclude,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.payment.findMany({
      where: { invoice: { facilityId } },
      include: billingPaymentInclude,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ])

  const analytics = analyticsRows[0]
  const amountCollectedToday = decimal(analytics?.amountCollectedToday)
  const overdueCount = Number(analytics?.overdueCount ?? 0)

  return {
    facilityName: actor.facility.name,
    invoicesCreatedToday: Number(analytics?.invoicesCreatedToday ?? 0),
    amountBilledToday: decimal(analytics?.amountBilledToday),
    amountCollectedToday,
    outstandingBalance: decimal(analytics?.outstandingBalance),
    paidInvoices: Number(analytics?.paidInvoices ?? 0),
    partiallyPaidInvoices: Number(analytics?.partiallyPaidInvoices ?? 0),
    unpaidInvoices: Number(analytics?.unpaidInvoices ?? 0),
    reversedPayments: Number(analytics?.reversedPayments ?? 0),
    paymentMethods: (analytics?.paymentMethods ?? []).map((item) => ({
      method: item.method as PaymentMethod,
      amount: Number(item.amount),
      count: Number(item.count),
    })),
    collectionTrend: (analytics?.collectionTrend ?? []).map((item) => ({
      date: item.date,
      billed: Number(item.billed),
      collected: Number(item.collected),
    })),
    recentInvoices: recentInvoices.map(serializeInvoiceList),
    recentPayments: recentPayments.map(serializePayment),
    alerts: [
      ...(overdueCount
        ? [{ id: "overdue", title: "Outstanding over 30 days", detail: `${overdueCount} invoice${overdueCount === 1 ? "" : "s"} require follow-up.`, tone: "red" as const }]
        : []),
      ...(!amountCollectedToday
        ? [{ id: "collections", title: "No collections today", detail: "No successful payment has been recorded today.", tone: "orange" as const }]
        : []),
    ],
  }
}
