import type { AuthenticatedStaff } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import {
  serializeRecordsAppointment,
  serializeRecordsPatient,
  serializeRecordsQueue,
} from "@/lib/records-officer"
import type { RecordsOfficerDashboardSummary } from "@/types/records-officer"

type RecordsSummaryRow = {
  patientsToday: bigint
  appointmentsToday: bigint
  checkedIn: bigint
  waitingQueue: bigint
  missedAppointments: bigint
}

export async function loadRecordsOfficerDashboard(
  actor: AuthenticatedStaff,
  now = new Date()
): Promise<RecordsOfficerDashboardSummary> {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const facilityId = actor.facilityId

  const [summaryRows, recentPatients, todayAppointments, activeQueue] =
    await Promise.all([
      prisma.$queryRaw<RecordsSummaryRow[]>`
        SELECT
          (SELECT COUNT(*) FROM "Patient"
            WHERE "registeredFacilityId" = ${facilityId}
              AND "createdAt" >= ${start} AND "createdAt" < ${end}) AS "patientsToday",
          (SELECT COUNT(*) FROM "Appointment"
            WHERE "facilityId" = ${facilityId}
              AND "scheduledAt" >= ${start} AND "scheduledAt" < ${end}) AS "appointmentsToday",
          (SELECT COUNT(*) FROM "Appointment"
            WHERE "facilityId" = ${facilityId}
              AND "checkedInAt" >= ${start} AND "checkedInAt" < ${end}) AS "checkedIn",
          (SELECT COUNT(*) FROM "PatientQueue" q
            JOIN "Department" d ON d."id" = q."departmentId"
            WHERE d."facilityId" = ${facilityId}
              AND q."arrivedAt" >= ${start} AND q."arrivedAt" < ${end}
              AND q."status" IN ('WAITING', 'IN_TRIAGE')) AS "waitingQueue",
          (SELECT COUNT(*) FROM "Appointment"
            WHERE "facilityId" = ${facilityId} AND "status" = 'MISSED') AS "missedAppointments"
      `,
      prisma.patient.findMany({
        where: { registeredFacilityId: facilityId },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.appointment.findMany({
        where: { facilityId, scheduledAt: { gte: start, lt: end } },
        orderBy: { scheduledAt: "asc" },
        take: 8,
        include: { patient: true, department: true, clinician: true },
      }),
      prisma.patientQueue.findMany({
        where: {
          department: { facilityId },
          arrivedAt: { gte: start, lt: end },
          status: { in: ["WAITING", "IN_TRIAGE"] },
        },
        orderBy: { arrivedAt: "asc" },
        take: 8,
        include: { patient: true, department: true },
      }),
    ])

  const summary = summaryRows[0]
  return {
    facilityName: actor.facility.name,
    metrics: [
      { label: "Patients Registered Today", value: String(summary?.patientsToday ?? 0), detail: "New folders opened today", tone: "green" },
      { label: "Appointments Today", value: String(summary?.appointmentsToday ?? 0), detail: "Scheduled visits today", tone: "blue" },
      { label: "Checked-In Patients", value: String(summary?.checkedIn ?? 0), detail: "Patients checked into care", tone: "green" },
      { label: "Waiting In Queue", value: String(summary?.waitingQueue ?? 0), detail: "Awaiting front desk or triage flow", tone: "orange" },
      { label: "Missed Appointments", value: String(summary?.missedAppointments ?? 0), detail: "No-show follow-up queue", tone: "red" },
    ],
    recentPatients: recentPatients.map(serializeRecordsPatient),
    todayAppointments: todayAppointments.map(serializeRecordsAppointment),
    activeQueue: activeQueue.map(serializeRecordsQueue),
    duplicateWarnings: [],
  }
}
