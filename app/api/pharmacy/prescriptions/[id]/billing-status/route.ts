import type { NextRequest } from "next/server"
import { ensurePharmacyPrescription, decimal, pharmacyOk, withPharmacy } from "@/lib/pharmacy"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params
    const prescription = await ensurePharmacyPrescription(id, actor.facilityId)
    if (!prescription) throw new Error("PRESCRIPTION_NOT_FOUND")
    const invoice = prescription.encounter?.invoices[0]
    return pharmacyOk(invoice ? { invoiceId: invoice.id, invoiceNo: invoice.invoiceNo, invoiceStatus: invoice.status, medicationItems: invoice.items.filter((item) => item.itemType === "MEDICATION" || prescription.items.some((rxItem) => rxItem.id === item.referenceId || rxItem.medicationId === item.referenceId)).map((item) => ({ id: item.id, description: item.description, quantity: item.quantity, unitPrice: decimal(item.unitPrice), totalPrice: decimal(item.totalPrice) })), amountDue: decimal(invoice.totalAmount), amountPaid: decimal(invoice.amountPaid), balanceDue: decimal(invoice.balanceDue), paymentStatus: invoice.status } : { invoiceId: null, invoiceNo: null, invoiceStatus: null, medicationItems: [], amountDue: 0, amountPaid: 0, balanceDue: 0, paymentStatus: null })
  })
}

