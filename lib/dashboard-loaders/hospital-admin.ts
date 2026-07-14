import type { AuthenticatedStaff } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import type { HospitalAdminDashboardData } from "@/types/dashboard"

type HospitalSummaryRow = {
  patients: bigint
  appointmentsToday: bigint
  waitingQueue: bigint
  openEncounters: bigint
  totalRevenue: unknown
  outstanding: unknown
}

export async function loadHospitalAdminDashboard(
  staff: AuthenticatedStaff,
  now = new Date()
): Promise<HospitalAdminDashboardData> {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const facilityId = staff.facilityId

  const [summaryRows, departments, staffActivity] = await Promise.all([
    prisma.$queryRaw<HospitalSummaryRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Patient"
          WHERE "registeredFacilityId" = ${facilityId} AND "status" = 'ACTIVE') AS patients,
        (SELECT COUNT(*) FROM "Appointment"
          WHERE "facilityId" = ${facilityId}
            AND "scheduledAt" >= ${today}
            AND "scheduledAt" < ${tomorrow}) AS "appointmentsToday",
        (SELECT COUNT(*) FROM "PatientQueue" q
          JOIN "Department" d ON d."id" = q."departmentId"
          WHERE d."facilityId" = ${facilityId}
            AND q."status" IN ('WAITING', 'IN_TRIAGE', 'WITH_CLINICIAN')) AS "waitingQueue",
        (SELECT COUNT(*) FROM "Encounter"
          WHERE "facilityId" = ${facilityId}
            AND "status" IN ('DRAFT', 'IN_PROGRESS', 'AWAITING_LAB')) AS "openEncounters",
        (SELECT COALESCE(SUM("amountPaid"), 0) FROM "Invoice"
          WHERE "facilityId" = ${facilityId}) AS "totalRevenue",
        (SELECT COALESCE(SUM("balanceDue"), 0) FROM "Invoice"
          WHERE "facilityId" = ${facilityId}) AS outstanding
    `,
    prisma.department.findMany({
      where: { facilityId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            staff: true,
            encounters: {
              where: {
                status: { in: ["DRAFT", "IN_PROGRESS", "AWAITING_LAB"] },
              },
            },
            queues: {
              where: {
                status: { in: ["WAITING", "IN_TRIAGE", "WITH_CLINICIAN"] },
              },
            },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { actor: { facilityId } },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        description: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
  ])

  const summary = summaryRows[0]
  const patients = Number(summary?.patients ?? 0)
  const appointmentsToday = Number(summary?.appointmentsToday ?? 0)
  const waitingQueue = Number(summary?.waitingQueue ?? 0)
  const openEncounters = Number(summary?.openEncounters ?? 0)
  const totalRevenue = Number(summary?.totalRevenue ?? 0)
  const outstanding = Number(summary?.outstanding ?? 0)

  return {
    facilityName: staff.facility.name,
    metrics: [
      { label: "Patients", value: String(patients), detail: "Active patient records", tone: "green" },
      { label: "Appointments Today", value: String(appointmentsToday), detail: "Scheduled clinical visits", tone: "blue" },
      { label: "Queue Load", value: String(waitingQueue), detail: "Waiting across departments", tone: "orange" },
      { label: "Revenue", value: `GHS ${totalRevenue.toLocaleString()}`, detail: `GHS ${outstanding.toLocaleString()} outstanding`, tone: "green" },
    ],
    patientFlow: [
      { label: "Waiting", value: waitingQueue },
      { label: "Open encounters", value: openEncounters },
      { label: "Appointments", value: appointmentsToday },
    ],
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      staffCount: department._count.staff,
      openEncounters: department._count.encounters,
      queueCount: department._count.queues,
    })),
    staffActivity: staffActivity.map((log) => ({
      id: log.id,
      label: `${log.action} ${log.entityType}`,
      detail: log.description || `By ${log.actor?.name ?? log.actor?.email ?? "System"}`,
      timestamp: log.createdAt.toISOString(),
    })),
  }
}
