import type { NextRequest } from "next/server"

import { billingOk, decimal, ensureBillingPayment, fullName, serializePayment, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { ReceiptDetail } from "@/types/billing"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const payment = await ensureBillingPayment(id, actor.facilityId)
    const [facility, successful] = await Promise.all([
      prisma.facility.findUniqueOrThrow({ where: { id: actor.facilityId } }),
      prisma.payment.findMany({ where: { invoiceId: payment.invoiceId, status: "SUCCESSFUL" }, select: { id: true, amount: true } }),
    ])
    const totalPaid = successful.reduce((sum, item) => sum + decimal(item.amount), 0)
    const currentPayment = decimal(payment.amount)
    const data: ReceiptDetail = {
      facility: { name: facility.name, address: facility.address, phone: facility.phone, email: facility.email },
      receiptNo: payment.receiptNo,
      invoiceNo: payment.invoice.invoiceNo,
      patient: { id: payment.invoice.patient.id, patientNo: payment.invoice.patient.patientNo, name: fullName(payment.invoice.patient), phone: payment.invoice.patient.phone, nhisNumber: payment.invoice.patient.nhisNumber },
      payment: serializePayment(payment),
      totalAmount: decimal(payment.invoice.totalAmount),
      amountPaidBefore: Math.max(0, totalPaid - (payment.status === "SUCCESSFUL" ? currentPayment : 0)),
      currentPayment,
      totalPaid,
      remainingBalance: decimal(payment.invoice.balanceDue),
    }
    return billingOk(data)
  })
}
