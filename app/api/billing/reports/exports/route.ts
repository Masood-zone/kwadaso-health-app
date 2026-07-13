import type { NextRequest } from "next/server"

import { AuditAction } from "@/lib/generated/prisma/enums"
import { billingOk, withBilling, writeBillingAuditLog } from "@/lib/billing"
import { reportExportSchema } from "@/lib/billing-schemas"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const parsed = reportExportSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Export request is invalid.", code: "VALIDATION_ERROR", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.reportExport.create({ data: { type: "FINANCIAL", title: parsed.data.title, facilityId: actor.facilityId, generatedById: actor.id, parameters: { reportType: parsed.data.reportType, ...(parsed.data.filters ?? {}) }, dateFrom: parsed.data.dateFrom ? new Date(`${parsed.data.dateFrom}T00:00:00.000Z`) : null, dateTo: parsed.data.dateTo ? new Date(`${parsed.data.dateTo}T23:59:59.999Z`) : null, status: "REQUESTED" } })
      await writeBillingAuditLog({ client: tx, request, actor, action: AuditAction.EXPORT, entityType: "ReportExport", entityId: created.id, description: `Requested financial export: ${created.title}`, after: { reportType: parsed.data.reportType, status: created.status } })
      return created
    })
    return billingOk({ id: record.id, title: record.title, status: record.status, generatedAt: record.generatedAt.toISOString(), generatedByName: actor.name }, "Export request queued. Download generation is still in progress.", 202)
  })
}
