import type { AuthenticatedStaff } from "@/lib/auth-session"
import {
  serializeImmunization,
  serializeQueueEntry,
  serializeVitalSigns,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { NurseDashboardSummary } from "@/types/nurse"

type NurseSummaryRow = {
  departmentName: string | null
  waiting: bigint
  inTriage: bigint
  emergency: bigint
  withClinician: bigint
  vitalsToday: bigint
  immunizationsToday: bigint
}

export async function loadNurseDashboard(
  actor: AuthenticatedStaff,
  now = new Date()
): Promise<NurseDashboardSummary> {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const facilityId = actor.facilityId

  const [summaryRows, queue, vitals, immunizations] = await Promise.all([
    prisma.$queryRaw<NurseSummaryRow[]>`
      SELECT
        (SELECT d."name" FROM "Department" d
          WHERE d."facilityId" = ${facilityId}
            AND d."type" = 'TRIAGE' AND d."isActive" = true
          ORDER BY d."name" LIMIT 1) AS "departmentName",
        (SELECT COUNT(*) FROM "PatientQueue" q JOIN "Department" d ON d."id" = q."departmentId"
          WHERE d."facilityId" = ${facilityId} AND q."status" = 'WAITING') AS waiting,
        (SELECT COUNT(*) FROM "PatientQueue" q JOIN "Department" d ON d."id" = q."departmentId"
          WHERE d."facilityId" = ${facilityId} AND q."status" = 'IN_TRIAGE') AS "inTriage",
        (SELECT COUNT(*) FROM "PatientQueue" q JOIN "Department" d ON d."id" = q."departmentId"
          WHERE d."facilityId" = ${facilityId} AND q."priority" = 'EMERGENCY'
            AND q."status" NOT IN ('COMPLETED', 'CANCELLED')) AS emergency,
        (SELECT COUNT(*) FROM "PatientQueue" q JOIN "Department" d ON d."id" = q."departmentId"
          WHERE d."facilityId" = ${facilityId} AND q."status" = 'WITH_CLINICIAN') AS "withClinician",
        (SELECT COUNT(*) FROM "VitalSigns" v JOIN "Patient" p ON p."id" = v."patientId"
          WHERE p."registeredFacilityId" = ${facilityId}
            AND v."capturedAt" >= ${start} AND v."capturedAt" < ${end}) AS "vitalsToday",
        (SELECT COUNT(*) FROM "ImmunizationRecord" i JOIN "Patient" p ON p."id" = i."patientId"
          WHERE p."registeredFacilityId" = ${facilityId}
            AND i."administeredAt" >= ${start} AND i."administeredAt" < ${end}) AS "immunizationsToday"
    `,
    prisma.patientQueue.findMany({
      where: {
        department: { facilityId },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      take: 12,
      orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }],
      include: {
        department: true,
        patient: {
          include: { vitalSigns: { take: 1, orderBy: { capturedAt: "desc" } } },
        },
      },
    }),
    prisma.vitalSigns.findMany({
      where: { patient: { registeredFacilityId: facilityId } },
      take: 5,
      orderBy: { capturedAt: "desc" },
      include: { patient: true, capturedBy: true },
    }),
    prisma.immunizationRecord.findMany({
      where: { patient: { registeredFacilityId: facilityId } },
      take: 5,
      orderBy: { administeredAt: "desc" },
      include: { patient: true, administeredBy: true },
    }),
  ])

  const summary = summaryRows[0]
  const averageWaitingMinutes = queue.length
    ? Math.round(
        queue.reduce(
          (total, entry) => total + (now.getTime() - entry.arrivedAt.getTime()) / 60_000,
          0
        ) / queue.length
      )
    : 0

  return {
    facilityName: actor.facility.name,
    departmentName: summary?.departmentName ?? actor.department?.name ?? "Triage",
    metrics: [
      { label: "Waiting", value: String(summary?.waiting ?? 0), detail: "Patients waiting for vitals", tone: "orange" },
      { label: "In Triage", value: String(summary?.inTriage ?? 0), detail: "Patients currently being screened", tone: "blue" },
      { label: "Emergency", value: String(summary?.emergency ?? 0), detail: "Patients needing immediate attention", tone: "red" },
      { label: "Sent To Clinician", value: String(summary?.withClinician ?? 0), detail: "Completed triage handoffs", tone: "green" },
      { label: "Vitals Today", value: String(summary?.vitalsToday ?? 0), detail: "Captured across triage", tone: "blue" },
      { label: "Immunizations", value: String(summary?.immunizationsToday ?? 0), detail: "Recorded today", tone: "green" },
      { label: "Avg Wait", value: `${averageWaitingMinutes}m`, detail: "Current active queue average", tone: "orange" },
    ],
    triageQueue: queue.slice(0, 8).map(serializeQueueEntry),
    emergencyPatients: queue.filter((entry) => entry.priority === "EMERGENCY").slice(0, 6).map(serializeQueueEntry),
    recentVitals: vitals.map(serializeVitalSigns),
    recentImmunizations: immunizations.map(serializeImmunization),
  }
}
