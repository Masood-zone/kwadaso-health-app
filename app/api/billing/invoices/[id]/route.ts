import type { NextRequest } from "next/server"

import {
  billingInvoiceInclude,
  billingOk,
  BillingError,
  calculateInvoiceTotals,
  ensureBillingInvoice,
  serializeInvoice,
  validateInvoiceSources,
  withBilling,
  writeBillingAuditLog,
} from "@/lib/billing"
import { invoiceUpdateSchema } from "@/lib/billing-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const invoice = await ensureBillingInvoice(id, actor.facilityId)
    return billingOk(serializeInvoice(invoice))
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const parsed = invoiceUpdateSchema.safeParse(await request.json())
    if (!parsed.success)
      return Response.json(
        {
          success: false,
          message: "Invoice changes are invalid.",
          code: "VALIDATION_ERROR",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    const updated = await prisma.$transaction(async (tx) => {
      const before = await ensureBillingInvoice(id, actor.facilityId, tx)
      const successfulPayments = before.payments.filter(
        (payment) => payment.status === "SUCCESSFUL"
      ).length
      const editingMoney =
        parsed.data.items !== undefined ||
        parsed.data.discountAmount !== undefined ||
        parsed.data.taxAmount !== undefined
      if (
        editingMoney &&
        (!(["DRAFT", "ISSUED"] as string[]).includes(before.status) ||
          successfulPayments)
      ) {
        throw new BillingError(
          "Invoice items and totals cannot be edited after payment or closure.",
          "INVOICE_READ_ONLY",
          409
        )
      }
      if (parsed.data.status === "ISSUED" && before.status !== "DRAFT")
        throw new BillingError(
          "Only a draft invoice can be issued.",
          "INVALID_INVOICE_TRANSITION",
          409
        )
      if (parsed.data.status === "CANCELLED") {
        if (!["DRAFT", "ISSUED"].includes(before.status) || successfulPayments)
          throw new BillingError(
            "Only an unpaid draft or issued invoice can be cancelled.",
            "INVALID_INVOICE_TRANSITION",
            409
          )
        if (!parsed.data.reason)
          throw new BillingError(
            "Cancellation reason is required.",
            "REASON_REQUIRED"
          )
      }
      if (parsed.data.status === "VOID") {
        if (before.status !== "ISSUED" || successfulPayments)
          throw new BillingError(
            "Only an unpaid issued invoice can be voided.",
            "INVALID_INVOICE_TRANSITION",
            409
          )
        if (!parsed.data.reason)
          throw new BillingError("Void reason is required.", "REASON_REQUIRED")
        if (parsed.data.replacementInvoiceId)
          await ensureBillingInvoice(
            parsed.data.replacementInvoiceId,
            actor.facilityId,
            tx
          )
      }
      const payloadItems =
        parsed.data.items ??
        before.items.map((item) => ({
          description: item.description,
          itemType: item.itemType ?? "OTHER",
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          referenceId: item.referenceId,
          sourceKey: item.sourceKey,
        }))
      await validateInvoiceSources(
        payloadItems,
        actor.facilityId,
        before.patientId,
        tx,
        id
      )
      const totals = calculateInvoiceTotals(
        payloadItems,
        parsed.data.discountAmount ?? Number(before.discountAmount),
        parsed.data.taxAmount ?? Number(before.taxAmount)
      )
      if (parsed.data.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
        await tx.invoiceItem.createMany({
          data: totals.items.map((item) => ({
            invoiceId: id,
            description: item.description,
            itemType: item.itemType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            referenceId: item.referenceId,
            sourceKey: item.sourceKey,
          })),
        })
      }
      const now = new Date()
      const invoice = await tx.invoice.update({
        where: { id },
        data: {
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          balanceDue: totals.totalAmount,
          notes: parsed.data.notes,
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(parsed.data.status === "ISSUED" ? { issuedAt: now } : {}),
          ...(parsed.data.status === "CANCELLED"
            ? {
                cancelledAt: now,
                cancelledById: actor.id,
                cancellationReason: parsed.data.reason,
                balanceDue: 0,
              }
            : {}),
          ...(parsed.data.status === "VOID"
            ? {
                voidedAt: now,
                voidedById: actor.id,
                voidReason: parsed.data.reason,
                replacementInvoiceId: parsed.data.replacementInvoiceId,
                balanceDue: 0,
              }
            : {}),
        },
        include: billingInvoiceInclude,
      })
      if (parsed.data.status === "CANCELLED" || parsed.data.status === "VOID") {
        // Keep the historical reference while allowing a reviewed replacement
        // invoice to claim this service's unique billing source key.
        await tx.invoiceItem.updateMany({
          where: { invoiceId: id },
          data: { sourceKey: null },
        })
      }
      if (parsed.data.status === "ISSUED") {
        await tx.notification.create({
          data: {
            facilityId: actor.facilityId,
            targetRole: "BILLING_OFFICER",
            type: "BILLING",
            priority: "NORMAL",
            title: "Invoice issued",
            body: `${invoice.invoiceNo} was issued with a balance of GH₵${Number(invoice.balanceDue).toFixed(2)}.`,
            actionUrl: `/billing/invoices/${invoice.id}`,
            entityType: "Invoice",
            entityId: invoice.id,
            createdById: actor.id,
          },
        })
      }
      await writeBillingAuditLog({
        client: tx,
        request,
        actor,
        action:
          parsed.data.status === "CANCELLED" || parsed.data.status === "VOID"
            ? AuditAction.REJECT
            : AuditAction.UPDATE,
        entityType: "Invoice",
        entityId: id,
        description: parsed.data.status
          ? `${parsed.data.status.replaceAll("_", " ")} invoice ${before.invoiceNo}`
          : `Updated invoice ${before.invoiceNo}`,
        before: {
          status: before.status,
          subtotal: Number(before.subtotal),
          discountAmount: Number(before.discountAmount),
          taxAmount: Number(before.taxAmount),
          totalAmount: Number(before.totalAmount),
          itemCount: before.items.length,
        },
        after: {
          status: invoice.status,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          itemCount: totals.items.length,
          reason: parsed.data.reason,
        },
      })
      return invoice
    })
    return billingOk(serializeInvoice(updated), "Invoice updated.")
  })
}
