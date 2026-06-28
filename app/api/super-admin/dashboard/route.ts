import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import {
  auditActions,
  departmentTypes,
  ensureSystemRolesAndPermissions,
  facilityTypes,
  getPrimaryFacility,
  getSettingsData,
  serializeDepartment,
  serializePermission,
  serializeRole,
  serializeStaff,
  staffRoles,
  userStatuses,
} from "@/lib/super-admin"
import type { ApiResponse } from "@/types"
import type { SuperAdminDashboardData } from "@/types/dashboard"
import type { SuperAdminAuditLogItem } from "@/types/super-admin"

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  try {
    await ensureSystemRolesAndPermissions()

    const [
      staffCount,
      activeDepartments,
      activePatients,
      auditLogs,
      roleOverview,
      facility,
      staff,
      departments,
      allRoles,
      permissions,
      settings,
      auditTotal,
    ] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.department.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { status: "ACTIVE" } }),
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { actor: true },
      }),
      prisma.role.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              permissions: true,
              users: true,
            },
          },
        },
      }),
      getPrimaryFacility(),
      prisma.user.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { department: true, facility: true },
      }),
      prisma.department.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { staff: true } } },
      }),
      prisma.role.findMany({
        orderBy: { name: "asc" },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      }),
      prisma.permission.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] }),
      getSettingsData(),
      prisma.auditLog.count(),
    ])

    const serializedAuditLogs: SuperAdminAuditLogItem[] = auditLogs.map((log) => ({
      id: log.id,
      actorName: log.actor?.name ?? "System",
      actorEmail: log.actor?.email ?? null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    }))

    const data: SuperAdminDashboardData = {
      facilityName: facility?.name ?? "SDA Hospital Kwadaso",
      metrics: [
        {
          label: "Active Staff",
          value: staffCount.toString(),
          detail: "Staff accounts available for duty",
          tone: "green",
        },
        {
          label: "Departments",
          value: activeDepartments.toString(),
          detail: "Operational units configured",
          tone: "blue",
        },
        {
          label: "Active Patients",
          value: activePatients.toString(),
          detail: "Current EHR patient records",
          tone: "orange",
        },
        {
          label: "Audit Events",
          value: auditLogs.length.toString(),
          detail: "Recent monitored actions",
          tone: "red",
        },
      ],
      roleOverview: roleOverview.map((role) => ({
        role: role.name,
        users: role._count.users,
        permissions: role._count.permissions,
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        label: `${log.action} ${log.entityType}`,
        detail:
          log.description ||
          `By ${log.actor?.name ?? log.actor?.email ?? "System"}`,
        timestamp: log.createdAt.toISOString(),
      })),
      departments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        type: department.type,
        staffCount: department._count.staff,
      })),
      management: {
        lookups: {
          roles: staffRoles,
          statuses: userStatuses,
          departmentTypes,
          facilityTypes,
          auditActions,
        },
        staff: staff.map(serializeStaff),
        departments: departments.map(serializeDepartment),
        permissions: permissions.map(serializePermission),
        roles: allRoles.map(serializeRole),
        settings,
        auditLogs: serializedAuditLogs,
        auditPagination: {
          page: 1,
          pageSize: 5,
          total: auditTotal,
          totalPages: Math.max(Math.ceil(auditTotal / 5), 1),
        },
      },
    }

    return Response.json({
      success: true,
      data,
    } satisfies ApiResponse<SuperAdminDashboardData>)
  } catch (error) {
    console.error("Failed to load super admin dashboard", error)
    return Response.json(
      {
        success: false,
        message: "Super admin dashboard could not be loaded.",
      } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
