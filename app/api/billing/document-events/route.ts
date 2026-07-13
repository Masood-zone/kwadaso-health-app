import type { NextRequest } from "next/server"

import { AuditAction } from "@/lib/generated/prisma/enums"
import { billingOk, BillingError, ensureBillingInvoice, ensureBillingPatient, ensureBillingPayment, withBilling, writeBillingAuditLog } from "@/lib/billing"
import { documentEventSchema } from "@/lib/billing-schemas"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const parsed = documentEventSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Document event is invalid.", code: "VALIDATION_ERROR" }, { status: 400 })
    if (parsed.data.documentType === "INVOICE") await ensureBillingInvoice(parsed.data.documentId, actor.facilityId)
    if (parsed.data.documentType === "RECEIPT") await ensureBillingPayment(parsed.data.documentId, actor.facilityId)
    if (parsed.data.documentType === "STATEMENT") await ensureBillingPatient(parsed.data.documentId, actor.facilityId)
    if (parsed.data.documentType === "REPORT") {
      const report = await prisma.reportExport.findFirst({ where: { id: parsed.data.documentId, facilityId: actor.facilityId } })
      if (!report) throw new BillingError("Report was not found in your facility.", "REPORT_NOT_FOUND", 404)
    }
    await writeBillingAuditLog({ request, actor, action: parsed.data.action === "PRINT" ? AuditAction.PRINT : AuditAction.EXPORT, entityType: `${parsed.data.documentType}Document`, entityId: parsed.data.documentId, description: `${parsed.data.action === "PRINT" ? "Printed" : "Exported"} ${parsed.data.documentType.toLowerCase()} document` })
    return billingOk({ recorded: true })
  })
}
