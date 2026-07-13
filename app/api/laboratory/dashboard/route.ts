import { NextRequest } from "next/server"

import { laboratoryRequestScope, laboratoryResultScope, requireLaboratoryApi, serializeLabRequestQueueItem } from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LaboratoryDashboardSummary } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const facilityId = actor!.facilityId
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const requestScope = laboratoryRequestScope(facilityId)
  const resultScope = laboratoryResultScope(facilityId)
  const [
    facility,
    newRequests,
    awaitingCollection,
    collectedToday,
    processing,
    awaitingValidation,
    critical,
    releasedToday,
    released,
    delayed,
    categories,
  ] = await Promise.all([
    prisma.facility.findUnique({ where: { id: facilityId } }),
    prisma.labRequest.count({ where: { ...requestScope, status: "REQUESTED", requestedAt: { gte: start, lte: end } } }),
    prisma.labRequest.count({ where: { ...requestScope, status: "REQUESTED" } }),
    prisma.labSample.count({ where: { labRequest: requestScope, collectedAt: { gte: start, lte: end } } }),
    prisma.labRequest.count({ where: { ...requestScope, status: "PROCESSING" } }),
    prisma.labResult.count({ where: { ...resultScope, status: "ENTERED" } }),
    prisma.labResult.count({ where: { ...resultScope, criticalFlag: true, status: { not: "RELEASED" } } }),
    prisma.labResult.count({ where: { ...resultScope, status: "RELEASED", releasedAt: { gte: start, lte: end } } }),
    prisma.labResult.findMany({
      where: { ...resultScope, status: "RELEASED", releasedAt: { not: null } },
      select: { releasedAt: true, requestTest: { select: { labRequest: { select: { requestedAt: true } } } } },
      take: 500,
    }),
    prisma.labRequest.findMany({
      where: { ...requestScope, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: { patient: true, requestedBy: true, tests: { include: { test: true } } },
      orderBy: [{ priority: "desc" }, { requestedAt: "asc" }],
      take: 8,
    }),
    prisma.labRequestTest.groupBy({
      by: ["testId"],
      where: { labRequest: requestScope },
      _count: { _all: true },
      orderBy: { _count: { testId: "desc" } },
      take: 8,
    }),
  ])
  const categoryTests = await prisma.labTestCatalog.findMany({
    where: { id: { in: categories.map((item) => item.testId) }, facilityId },
    select: { id: true, category: true },
  })
  const categoryMap = new Map(categoryTests.map((item) => [item.id, item.category ?? "Uncategorized"]))
  const categoryVolume = new Map<string, number>()
  for (const item of categories) {
    const category = categoryMap.get(item.testId) ?? "Uncategorized"
    categoryVolume.set(category, (categoryVolume.get(category) ?? 0) + item._count._all)
  }
  const averageTurnaroundMinutes = released.length
    ? Math.round(
        released.reduce(
          (sum, item) => sum + ((item.releasedAt?.getTime() ?? 0) - item.requestTest.labRequest.requestedAt.getTime()) / 60000,
          0
        ) / released.length
      )
    : 0
  const sampleTotal = await prisma.labSample.count({ where: { labRequest: requestScope } })
  const receivedTotal = await prisma.labSample.count({
    where: { labRequest: requestScope, status: { in: ["RECEIVED", "PROCESSING", "STORED", "DISPOSED"] } },
  })
  const resultsTotal = await prisma.labResult.count({ where: resultScope })
  const validatedTotal = await prisma.labResult.count({ where: { ...resultScope, status: { in: ["VALIDATED", "RELEASED"] } } })
  const data: LaboratoryDashboardSummary = {
    facilityName: facility?.name ?? "Kwadaso HealthLink",
    metrics: [
      { label: "New Requests", value: String(newRequests), detail: "Received today", tone: "green" },
      { label: "Awaiting Collection", value: String(awaitingCollection), detail: "Requests without a collected sample", tone: "orange" },
      { label: "Collected Today", value: String(collectedToday), detail: "Samples collected today", tone: "green" },
      { label: "In Progress", value: String(processing), detail: "Tests currently processing", tone: "blue" },
      { label: "Awaiting Validation", value: String(awaitingValidation), detail: "Entered results pending review", tone: "orange" },
      { label: "Critical Results", value: String(critical), detail: "Immediate action required", tone: "red" },
      { label: "Released Today", value: String(releasedToday), detail: "Available to clinicians", tone: "green" },
      { label: "Average TAT", value: `${Math.round(averageTurnaroundMinutes / 6) / 10}h`, detail: "Request to result release", tone: "blue" },
    ],
    delayedRequests: delayed.map(serializeLabRequestQueueItem),
    categoryVolume: [...categoryVolume.entries()].map(([category, count]) => ({ category, count })),
    workflowEfficiency: {
      sampleReception: sampleTotal ? Math.round((receivedTotal / sampleTotal) * 100) : 100,
      processing: processing ? Math.max(0, Math.min(100, 100 - processing * 2)) : 100,
      validation: resultsTotal ? Math.round((validatedTotal / resultsTotal) * 100) : 100,
    },
  }
  return Response.json({ success: true, data } satisfies ApiResponse<LaboratoryDashboardSummary>)
}
