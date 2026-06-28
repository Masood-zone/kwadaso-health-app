import { NextRequest } from "next/server"

import {
  requireRecordsOfficerApi,
  serializeTimelineItem,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id } = await context.params
  const patient = await prisma.patient.findFirst({
    where: { id, registeredFacilityId: actor!.facilityId },
  })
  if (!patient) return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })

  const [appointments, queues, encounters, documents, labRequests, prescriptions, invoices, referrals] =
    await Promise.all([
      prisma.appointment.findMany({ where: { patientId: id, facilityId: actor!.facilityId }, take: 20 }),
      prisma.patientQueue.findMany({ where: { patientId: id, department: { facilityId: actor!.facilityId } }, take: 20 }),
      prisma.encounter.findMany({ where: { patientId: id, facilityId: actor!.facilityId }, take: 20 }),
      prisma.patientDocument.findMany({ where: { patientId: id }, take: 20 }),
      prisma.labRequest.findMany({ where: { patientId: id }, take: 20 }),
      prisma.prescription.findMany({ where: { patientId: id }, take: 20 }),
      prisma.invoice.findMany({ where: { patientId: id, facilityId: actor!.facilityId }, take: 20 }),
      prisma.referral.findMany({ where: { patientId: id, fromFacilityId: actor!.facilityId }, take: 20 }),
    ])

  const data = [
    ...appointments.map((item) =>
      serializeTimelineItem(item.id, "Appointment", item.appointmentNo, item.reason, item.status, item.scheduledAt)
    ),
    ...queues.map((item) =>
      serializeTimelineItem(item.id, "Queue", item.queueNo, item.reason, item.status, item.arrivedAt)
    ),
    ...encounters.map((item) =>
      serializeTimelineItem(item.id, "Encounter", item.encounterNo, item.chiefComplaint, item.status, item.startedAt)
    ),
    ...documents.map((item) =>
      serializeTimelineItem(item.id, "Document", item.title, item.type, null, item.createdAt)
    ),
    ...labRequests.map((item) =>
      serializeTimelineItem(item.id, "Lab Request", item.requestNo, "Laboratory request status", item.status, item.requestedAt)
    ),
    ...prescriptions.map((item) =>
      serializeTimelineItem(item.id, "Prescription", item.prescriptionNo, "Prescription status", item.status, item.createdAt)
    ),
    ...invoices.map((item) =>
      serializeTimelineItem(item.id, "Invoice", item.invoiceNo, "Billing status summary", item.status, item.createdAt)
    ),
    ...referrals.map((item) =>
      serializeTimelineItem(item.id, "Referral", item.referralNo, item.reason, item.status, item.createdAt)
    ),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

  return Response.json({ success: true, data } satisfies ApiResponse)
}
