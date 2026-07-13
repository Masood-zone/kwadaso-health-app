import type { NextRequest } from "next/server"

import { billingInvoiceInclude, billingPaymentInclude, billingOk, decimal, ensureBillingPatient, fullName, getPendingCharges, serializeInvoiceList, serializePayment, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"
import type { PatientBillingSummary } from "@/types/billing"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withBilling(request, async (actor) => {
    const { id } = await context.params
    const patient = await ensureBillingPatient(id, actor.facilityId)
    const [activeEncounter, appointments, invoices, payments, pendingCharges, latestLab, latestDispensing] = await Promise.all([
      prisma.encounter.findFirst({ where: { patientId: id, facilityId: actor.facilityId, status: { notIn: ["COMPLETED", "CANCELLED"] } }, include: { department: true }, orderBy: { startedAt: "desc" } }),
      prisma.appointment.findMany({ where: { patientId: id, facilityId: actor.facilityId }, include: { department: true }, orderBy: { scheduledAt: "desc" }, take: 5 }),
      prisma.invoice.findMany({ where: { patientId: id, facilityId: actor.facilityId }, include: billingInvoiceInclude, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.payment.findMany({ where: { invoice: { patientId: id, facilityId: actor.facilityId } }, include: billingPaymentInclude, orderBy: { createdAt: "desc" }, take: 10 }),
      getPendingCharges(id, actor.facilityId),
      prisma.labRequest.findFirst({ where: { patientId: id, OR: [{ encounterId: null }, { encounter: { facilityId: actor.facilityId } }] }, select: { status: true }, orderBy: { requestedAt: "desc" } }),
      prisma.dispensing.findFirst({ where: { patientId: id }, select: { status: true }, orderBy: { createdAt: "desc" } }),
    ])
    const data: PatientBillingSummary = {
      patient: { id: patient.id, patientNo: patient.patientNo, name: fullName(patient), phone: patient.phone, nhisNumber: patient.nhisNumber },
      activeEncounter: activeEncounter ? { id: activeEncounter.id, encounterNo: activeEncounter.encounterNo, status: activeEncounter.status, departmentName: activeEncounter.department.name, startedAt: activeEncounter.startedAt.toISOString() } : null,
      recentAppointments: appointments.map((item) => ({ id: item.id, appointmentNo: item.appointmentNo, title: item.title, status: item.status, scheduledAt: item.scheduledAt.toISOString(), departmentName: item.department?.name ?? null })),
      pendingCharges,
      invoices: invoices.map(serializeInvoiceList),
      payments: payments.map(serializePayment),
      outstandingBalance: invoices.filter((item) => ["ISSUED", "PARTIALLY_PAID"].includes(item.status)).reduce((sum, item) => sum + decimal(item.balanceDue), 0),
      latestLabStatus: latestLab?.status ?? null,
      latestDispensingStatus: latestDispensing?.status ?? null,
    }
    return billingOk(data)
  })
}
