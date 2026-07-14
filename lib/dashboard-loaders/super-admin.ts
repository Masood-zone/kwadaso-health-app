import type { AuthenticatedStaff } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import type { SuperAdminDashboardSummary } from "@/types/dashboard"

type SuperAdminSummaryRow = {
  staffCount: bigint
  activeDepartments: bigint
  activePatients: bigint
}

export async function loadSuperAdminDashboardSummary(
  actor: AuthenticatedStaff
): Promise<SuperAdminDashboardSummary> {
  const [summaryRows, roleOverview, departments, auditLogs] = await Promise.all([
    prisma.$queryRaw<SuperAdminSummaryRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "user" WHERE "status" = 'ACTIVE') AS "staffCount",
        (SELECT COUNT(*) FROM "Department" WHERE "isActive" = true) AS "activeDepartments",
        (SELECT COUNT(*) FROM "Patient" WHERE "status" = 'ACTIVE') AS "activePatients"
    `,
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: {
        name: true,
        _count: { select: { permissions: true, users: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        _count: { select: { staff: true } },
      },
    }),
    prisma.auditLog.findMany({
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
  return {
    facilityName: actor.facility.name,
    metrics: [
      { label: "Active Staff", value: String(summary?.staffCount ?? 0), detail: "Staff accounts available for duty", tone: "green" },
      { label: "Departments", value: String(summary?.activeDepartments ?? 0), detail: "Operational units configured", tone: "blue" },
      { label: "Active Patients", value: String(summary?.activePatients ?? 0), detail: "Current EHR patient records", tone: "orange" },
      { label: "Audit Events", value: String(auditLogs.length), detail: "Recent monitored actions", tone: "red" },
    ],
    roleOverview: roleOverview.map((role) => ({
      role: role.name,
      users: role._count.users,
      permissions: role._count.permissions,
    })),
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      type: department.type,
      staffCount: department._count.staff,
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      label: `${log.action} ${log.entityType}`,
      detail: log.description || `By ${log.actor?.name ?? log.actor?.email ?? "System"}`,
      timestamp: log.createdAt.toISOString(),
    })),
  }
}
