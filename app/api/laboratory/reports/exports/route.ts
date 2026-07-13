import { NextRequest } from "next/server"
import { z } from "zod"

import { laboratoryRequestScope, requireLaboratoryApi, writeLaboratoryAuditLog } from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LaboratoryReportExport } from "@/types/laboratory"

const schema = z.object({
  dateFrom: z.string().date().nullable().optional(),
  dateTo: z.string().date().nullable().optional(),
  testId: z.string().nullable().optional(),
  status: z.enum(["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "PARTIAL_RESULT", "COMPLETED", "CANCELLED"]).nullable().optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ success: false, message: "Report export filters are invalid." }, { status: 400 })
  const where = {
    ...laboratoryRequestScope(actor!.facilityId),
    ...(parsed.data.testId ? { tests: { some: { testId: parsed.data.testId } } } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
    ...((parsed.data.dateFrom || parsed.data.dateTo)
      ? { requestedAt: { ...(parsed.data.dateFrom ? { gte: new Date(`${parsed.data.dateFrom}T00:00:00.000Z`) } : {}), ...(parsed.data.dateTo ? { lte: new Date(`${parsed.data.dateTo}T23:59:59.999Z`) } : {}) } }
      : {}),
  }
  const rowCount = await prisma.labRequest.count({ where })
  const exported = await prisma.$transaction(async (tx) => {
    const record = await tx.reportExport.create({
      data: {
        type: "LABORATORY",
        title: `Laboratory report ${new Date().toISOString().slice(0, 10)}`,
        facilityId: actor!.facilityId,
        generatedById: actor!.id,
        parameters: parsed.data,
        rowCount,
        status: "COMPLETED",
        dateFrom: parsed.data.dateFrom ? new Date(`${parsed.data.dateFrom}T00:00:00.000Z`) : null,
        dateTo: parsed.data.dateTo ? new Date(`${parsed.data.dateTo}T23:59:59.999Z`) : null,
      },
    })
    await writeLaboratoryAuditLog({
      client: tx,
      request,
      actor: actor!,
      action: "EXPORT",
      entityType: "ReportExport",
      entityId: record.id,
      description: `Exported laboratory report with ${rowCount} request rows`,
      after: { rowCount, format: "CSV", filters: parsed.data },
    })
    return record
  })
  const data: LaboratoryReportExport = { id: exported.id, title: exported.title, status: exported.status, rowCount: exported.rowCount, dateFrom: exported.dateFrom?.toISOString() ?? null, dateTo: exported.dateTo?.toISOString() ?? null, generatedAt: exported.generatedAt.toISOString() }
  return Response.json({ success: true, data } satisfies ApiResponse<LaboratoryReportExport>, { status: 201 })
}
