import { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import type { LabPriority, LabRequestStatus } from "@/lib/generated/prisma/enums"
import { laboratoryRequestScope, parseDateRange, requireLaboratoryApi, serializeLabRequestQueueItem } from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LaboratoryReportData } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const params = request.nextUrl.searchParams
  const testId = params.get("testId")
  const status = params.get("status") as LabRequestStatus | null
  const priority = params.get("priority") as LabPriority | null
  const where: Prisma.LabRequestWhereInput = {
    ...laboratoryRequestScope(actor!.facilityId),
    ...(testId ? { tests: { some: { testId } } } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...parseDateRange(params, "requestedAt"),
  }
  const [rows, rejectedSamples, criticalResults, exports] = await Promise.all([
    prisma.labRequest.findMany({
      where,
      include: { patient: true, requestedBy: true, tests: { include: { test: true } }, samples: true },
      orderBy: { requestedAt: "desc" },
      take: 500,
    }),
    prisma.labSample.count({ where: { labRequest: where, status: "REJECTED" } }),
    prisma.labResult.count({ where: { requestTest: { labRequest: where }, criticalFlag: true } }),
    prisma.reportExport.findMany({ where: { facilityId: actor!.facilityId, type: "LABORATORY" }, orderBy: { generatedAt: "desc" }, take: 25 }),
  ])
  const completed = rows.filter((item) => item.status === "COMPLETED")
  const pending = rows.length - completed.length - rows.filter((item) => item.status === "CANCELLED").length
  const tatRows = completed.filter((item) => item.completedAt)
  const tat = tatRows.length
    ? Math.round(tatRows.reduce((sum, item) => sum + ((item.completedAt?.getTime() ?? 0) - item.requestedAt.getTime()) / 60000, 0) / tatRows.length)
    : 0
  const category = new Map<string, number>()
  const clinician = new Map<string, number>()
  const dates = new Map<string, { requested: number; completed: number }>()
  for (const row of rows) {
    clinician.set(row.requestedBy?.name ?? "Unassigned", (clinician.get(row.requestedBy?.name ?? "Unassigned") ?? 0) + row.tests.length)
    for (const item of row.tests) category.set(item.test.category ?? "Uncategorized", (category.get(item.test.category ?? "Uncategorized") ?? 0) + 1)
    const label = row.requestedAt.toISOString().slice(0, 10)
    const point = dates.get(label) ?? { requested: 0, completed: 0 }
    point.requested += row.tests.length
    if (row.status === "COMPLETED") point.completed += row.tests.length
    dates.set(label, point)
  }
  const data: LaboratoryReportData = {
    metrics: [
      { label: "Total Requests", value: String(rows.length), detail: "Within selected period", tone: "blue" },
      { label: "Completed Tests", value: String(completed.reduce((sum, item) => sum + item.tests.length, 0)), detail: "Released to clinicians", tone: "green" },
      { label: "Pending Tests", value: String(pending), detail: "Requests still in workflow", tone: "orange" },
      { label: "Rejected Samples", value: String(rejectedSamples), detail: "Recollection required", tone: "red" },
      { label: "Critical Results", value: String(criticalResults), detail: "Critical values recorded", tone: "red" },
      { label: "Average TAT", value: `${Math.round(tat / 6) / 10}h`, detail: "Request to completion", tone: "blue" },
    ],
    byCategory: [...category].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    byClinician: [...clinician].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    byDate: [...dates].map(([label, value]) => ({ label, ...value })).sort((a, b) => a.label.localeCompare(b.label)),
    rows: rows.map(serializeLabRequestQueueItem),
    exports: exports.map((item) => ({ id: item.id, title: item.title, status: item.status, rowCount: item.rowCount, dateFrom: item.dateFrom?.toISOString() ?? null, dateTo: item.dateTo?.toISOString() ?? null, generatedAt: item.generatedAt.toISOString() })),
  }
  return Response.json({ success: true, data } satisfies ApiResponse<LaboratoryReportData>)
}
