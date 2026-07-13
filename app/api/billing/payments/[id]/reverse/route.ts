import type { NextRequest } from "next/server"

import { AuditAction } from "@/lib/generated/prisma/enums"
import { billingOk, BillingError, ensureBillingPayment, recalculateInvoiceAfterPayments, serializePayment, withBilling, writeBillingAuditLog } from "@/lib/billing"
import { paymentReversalSchema } from "@/lib/billing-schemas"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const parsed = paymentReversalSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "A confirmed reversal reason is required.", code: "VALIDATION_ERROR", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    const reversed = await prisma.$transaction(async (tx) => {
      const before = await ensureBillingPayment(id, actor.facilityId, tx)
      if (before.status !== "SUCCESSFUL") throw new BillingError("Only a successful payment can be reversed.", "PAYMENT_NOT_REVERSIBLE", 409)
      await tx.payment.update({ where: { id }, data: { status: "REVERSED", reversedAt: new Date(), reversedById: actor.id, reversalReason: parsed.data.reason, reversalReference: parsed.data.reference } })
      const invoice = await recalculateInvoiceAfterPayments(tx, before.invoiceId)
      await writeBillingAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "Payment", entityId: id, description: `Reversed payment ${before.receiptNo}`, before: { status: before.status, amount: Number(before.amount), invoiceStatus: before.invoice.status }, after: { status: "REVERSED", reason: parsed.data.reason, reference: parsed.data.reference, invoiceStatus: invoice.status, balanceDue: Number(invoice.balanceDue) } })
      await tx.notification.create({ data: { recipientId: actor.id, facilityId: actor.facilityId, targetRole: "BILLING_OFFICER", type: "BILLING", priority: "HIGH", title: "Payment reversed", body: `${before.receiptNo} was reversed. ${before.invoice.invoiceNo} now has a balance of GH₵${Number(invoice.balanceDue).toFixed(2)}.`, actionUrl: `/billing/invoices/${before.invoiceId}`, entityType: "Payment", entityId: id, createdById: actor.id } })
      return tx.payment.findUniqueOrThrow({ where: { id }, include: { receivedBy: true, approvedBy: true, reversedBy: true, invoice: { include: { patient: true, encounter: { include: { department: true } }, createdBy: true } } } })
    }, { isolationLevel: "Serializable" })
    return billingOk(serializePayment(reversed), "Payment reversed and invoice balance recalculated.")
  })
}
