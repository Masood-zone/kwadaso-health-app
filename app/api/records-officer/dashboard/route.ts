import { NextRequest } from "next/server"

import {
  requireRecordsOfficerApi,
  serializeRecordsAppointment,
  serializeRecordsPatient,
  serializeRecordsQueue,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { start, end } = todayRange()
  const facilityId = actor!.facilityId

  const [
    patientsToday,
    appointmentsToday,
    checkedIn,
    waitingQueue,
    missedAppointments,
    recentPatients,
    todayAppointments,
    activeQueue,
  ] = await Promise.all([
    prisma.patient.count({
      where: { registeredFacilityId: facilityId, createdAt: { gte: start, lte: end } },
    }),
    prisma.appointment.count({
      where: { facilityId, scheduledAt: { gte: start, lte: end } },
    }),
    prisma.appointment.count({
      where: { facilityId, checkedInAt: { gte: start, lte: end } },
    }),
    prisma.patientQueue.count({
      where: {
        department: { facilityId },
        arrivedAt: { gte: start, lte: end },
        status: { in: ["WAITING", "IN_TRIAGE"] },
      },
    }),
    prisma.appointment.count({ where: { facilityId, status: "MISSED" } }),
    prisma.patient.findMany({
      where: { registeredFacilityId: facilityId },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.appointment.findMany({
      where: { facilityId, scheduledAt: { gte: start, lte: end } },
      orderBy: { scheduledAt: "asc" },
      take: 8,
      include: { patient: true, department: true, clinician: true },
    }),
    prisma.patientQueue.findMany({
      where: {
        department: { facilityId },
        arrivedAt: { gte: start, lte: end },
        status: { in: ["WAITING", "IN_TRIAGE"] },
      },
      orderBy: { arrivedAt: "asc" },
      take: 8,
      include: { patient: true, department: true },
    }),
  ])

  return Response.json({
    success: true,
    data: {
      facilityName: actor!.facility.name,
      metrics: [
        { label: "Patients Registered Today", value: String(patientsToday), detail: "New folders opened today", tone: "green" },
        { label: "Appointments Today", value: String(appointmentsToday), detail: "Scheduled visits today", tone: "blue" },
        { label: "Checked-In Patients", value: String(checkedIn), detail: "Patients checked into care", tone: "green" },
        { label: "Waiting In Queue", value: String(waitingQueue), detail: "Awaiting front desk or triage flow", tone: "orange" },
        { label: "Missed Appointments", value: String(missedAppointments), detail: "No-show follow-up queue", tone: "red" },
      ],
      recentPatients: recentPatients.map(serializeRecordsPatient),
      todayAppointments: todayAppointments.map(serializeRecordsAppointment),
      activeQueue: activeQueue.map(serializeRecordsQueue),
      duplicateWarnings: [],
    },
  } satisfies ApiResponse)
}
