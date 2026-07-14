import type { NextRequest } from "next/server"

import { AuditAction } from "@/lib/generated/prisma/enums"
import {
  billingOk,
  BillingError,
  ensureBillingInvoice,
  generateReceiptNo,
  recalculateInvoiceAfterPayments,
  serializePayment,
  toPesewas,
  withBilling,
  writeBillingAuditLog,
} from "@/lib/billing"
import { paymentCreateSchema } from "@/lib/billing-schemas"
import { prisma } from "@/lib/prisma"

const referenceMethods = ["MOBILE_MONEY", "CARD", "BANK_TRANSFER", "NHIS"]

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const parsed = paymentCreateSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Payment details are invalid.", code: "VALIDATION_ERROR", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    const payment = await prisma.$transaction(async (tx) => {
      const invoice = await ensureBillingInvoice(id, actor.facilityId, tx)
      if (!["ISSUED", "PARTIALLY_PAID"].includes(invoice.status)) throw new BillingError("Only an issued invoice with an outstanding balance can receive payment.", "INVOICE_NOT_PAYABLE", 409)
      if (toPesewas(parsed.data.amount) > toPesewas(invoice.balanceDue)) throw new BillingError("Payment cannot exceed the outstanding balance.", "OVERPAYMENT_NOT_ALLOWED", 409)
      if (referenceMethods.includes(parsed.data.method) && !parsed.data.reference) throw new BillingError("A transaction reference is required for this payment method.", "REFERENCE_REQUIRED")
      if (parsed.data.method === "WAIVER") {
        if (!parsed.data.notes || !parsed.data.approvalReference || !parsed.data.approvedById) throw new BillingError("Waivers require a reason, approving officer, and approval reference.", "WAIVER_APPROVAL_REQUIRED")
        const approver = await tx.user.findFirst({ where: { id: parsed.data.approvedById, facilityId: actor.facilityId, status: "ACTIVE" }, select: { id: true } })
        if (!approver) throw new BillingError("Approving officer was not found in your facility.", "APPROVER_NOT_FOUND", 404)
      }
      const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date()
      if (paidAt.getTime() > Date.now() + 60000) throw new BillingError("Payment date cannot be in the future.", "INVALID_PAYMENT_DATE")
      const created = await tx.payment.create({ data: { receiptNo: generateReceiptNo(), invoiceId: invoice.id, method: parsed.data.method, status: "SUCCESSFUL", amount: parsed.data.amount, reference: parsed.data.reference, notes: parsed.data.notes, approvalReference: parsed.data.approvalReference, approvedById: parsed.data.approvedById, receivedById: actor.id, paidAt } })
      const updatedInvoice = await recalculateInvoiceAfterPayments(tx, invoice.id)
      await writeBillingAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "Payment", entityId: created.id, description: `Recorded ${parsed.data.method.replaceAll("_", " ")} payment ${created.receiptNo}`, after: { receiptNo: created.receiptNo, invoiceId: invoice.id, amount: parsed.data.amount, method: parsed.data.method, invoiceStatus: updatedInvoice.status, balanceDue: Number(updatedInvoice.balanceDue) } })
      if (updatedInvoice.status === "PAID") await tx.notification.create({ data: { recipientId: actor.id, facilityId: actor.facilityId, targetRole: "BILLING_OFFICER", type: "BILLING", priority: "NORMAL", status: "UNREAD", title: "Invoice paid in full", body: `${updatedInvoice.invoiceNo} is now fully paid.`, actionUrl: `/billing/invoices/${invoice.id}`, entityType: "Invoice", entityId: invoice.id, createdById: actor.id } })
      return tx.payment.findUniqueOrThrow({ where: { id: created.id }, include: { receivedBy: true, approvedBy: true, reversedBy: true, invoice: { include: { patient: true, encounter: { include: { department: true } }, createdBy: true } } } })
    }, {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 30_000,
    })
    return billingOk(serializePayment(payment), "Payment recorded and receipt generated.", 201)
  })
}
