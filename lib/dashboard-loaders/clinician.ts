import type { AuthenticatedStaff } from "@/lib/auth-session"
import {
  clinicianQueueInclude,
  labResultInclude,
  serializeLabResult,
  serializeNotification,
  serializeQueue,
} from "@/lib/clinician-data"
import {
  endOfDay,
  notificationWhere,
  priorityRank,
  startOfDay,
} from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"
import type { ClinicianDashboardSummary } from "@/types/clinician"

type ClinicianSummaryRow = {
  waiting: bigint
  active: bigint
  awaitingLab: bigint
  prescriptionsToday: bigint
  followUpsDue: bigint
  criticalResults: bigint
  referralsToday: bigint
  completedToday: bigint
}

export async function loadClinicianDashboard(
  actor: AuthenticatedStaff
): Promise<ClinicianDashboardSummary> {
  const today = startOfDay()
  const endToday = endOfDay()
  const facilityId = actor.facilityId
  const actorId = actor.id

  const [summaryRows, queue, results, notifications] = await Promise.all([
    prisma.$queryRaw<ClinicianSummaryRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "PatientQueue" q JOIN "Department" d ON d."id" = q."departmentId"
          WHERE d."facilityId" = ${facilityId} AND q."status" = 'WITH_CLINICIAN'
            AND (q."assignedToId" = ${actorId} OR q."assignedToId" IS NULL)) AS waiting,
        (SELECT COUNT(*) FROM "Encounter" WHERE "facilityId" = ${facilityId}
          AND "clinicianId" = ${actorId}
          AND "status" IN ('DRAFT', 'IN_PROGRESS', 'AWAITING_LAB', 'AWAITING_PHARMACY')) AS active,
        (SELECT COUNT(*) FROM "LabRequest" lr JOIN "Encounter" e ON e."id" = lr."encounterId"
          WHERE lr."requestedById" = ${actorId} AND e."facilityId" = ${facilityId}
            AND lr."status" IN ('REQUESTED', 'SAMPLE_COLLECTED', 'PROCESSING', 'PARTIAL_RESULT')) AS "awaitingLab",
        (SELECT COUNT(*) FROM "Prescription" WHERE "prescribedById" = ${actorId}
          AND "issuedAt" >= ${today} AND "issuedAt" <= ${endToday}) AS "prescriptionsToday",
        (SELECT COUNT(*) FROM "Appointment" WHERE "facilityId" = ${facilityId}
          AND "clinicianId" = ${actorId} AND "scheduledAt" <= ${endToday}
          AND "status" IN ('SCHEDULED', 'RESCHEDULED')) AS "followUpsDue",
        (SELECT COUNT(*) FROM "LabResult" r JOIN "Encounter" e ON e."id" = r."encounterId"
          WHERE e."facilityId" = ${facilityId} AND e."clinicianId" = ${actorId}
            AND r."criticalFlag" = true AND r."status" IN ('VALIDATED', 'RELEASED')) AS "criticalResults",
        (SELECT COUNT(*) FROM "Referral" WHERE "referredById" = ${actorId}
          AND "createdAt" >= ${today} AND "createdAt" <= ${endToday}) AS "referralsToday",
        (SELECT COUNT(*) FROM "Encounter" WHERE "facilityId" = ${facilityId}
          AND "clinicianId" = ${actorId}
          AND "completedAt" >= ${today} AND "completedAt" <= ${endToday}) AS "completedToday"
    `,
    prisma.patientQueue.findMany({
      where: {
        department: { facilityId },
        status: { in: ["WITH_CLINICIAN", "AWAITING_LAB", "AWAITING_PHARMACY"] },
        OR: [{ assignedToId: actorId }, { assignedToId: null }],
      },
      include: clinicianQueueInclude,
      orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }],
      take: 8,
    }),
    prisma.labResult.findMany({
      where: {
        encounter: { facilityId, clinicianId: actorId },
        criticalFlag: true,
        status: { in: ["VALIDATED", "RELEASED"] },
      },
      include: labResultInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.notification.findMany({
      where: notificationWhere(actor),
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  const summary = summaryRows[0]
  return {
    facilityName: actor.facility.name,
    clinicianName: actor.name,
    metrics: [
      { label: "Waiting", value: Number(summary?.waiting ?? 0), detail: "Ready for consultation", tone: "orange" },
      { label: "Active encounters", value: Number(summary?.active ?? 0), detail: "Assigned to you", tone: "green" },
      { label: "Awaiting lab", value: Number(summary?.awaitingLab ?? 0), detail: "Open laboratory requests", tone: "orange" },
      { label: "Prescriptions today", value: Number(summary?.prescriptionsToday ?? 0), detail: "Issued today", tone: "blue" },
      { label: "Follow-ups due", value: Number(summary?.followUpsDue ?? 0), detail: "Scheduled through today", tone: "orange" },
      { label: "Critical results", value: Number(summary?.criticalResults ?? 0), detail: "Validated or released", tone: "red" },
      { label: "Referrals today", value: Number(summary?.referralsToday ?? 0), detail: "Created by you", tone: "blue" },
      { label: "Completed", value: Number(summary?.completedToday ?? 0), detail: "Consultations today", tone: "green" },
    ],
    queue: queue.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]).map((item) => serializeQueue(item, actorId)) as ClinicianDashboardSummary["queue"],
    criticalResults: results.map(serializeLabResult),
    notifications: notifications.map(serializeNotification) as ClinicianDashboardSummary["notifications"],
  }
}
