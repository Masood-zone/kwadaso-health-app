import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { SuperAdminDashboardData } from "@/types/dashboard"

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  try {
    const [
      staffCount,
      activeDepartments,
      activePatients,
      auditLogs,
      roleOverview,
      departments,
      facility,
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
      prisma.department.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              staff: true,
            },
          },
        },
      }),
      prisma.facility.findFirst({
        where: { type: "HOSPITAL", isActive: true },
        orderBy: { createdAt: "asc" },
      }),
    ])

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
