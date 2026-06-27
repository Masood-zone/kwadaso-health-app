import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { HospitalAdminDashboardData } from "@/types/dashboard"

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export async function GET(request: NextRequest) {
  const { staff, response } = await requireRoleApi(request, ["HOSPITAL_ADMIN"])
  if (response) return response

  try {
    const facilityId = staff!.facilityId
    const today = startOfToday()

    const [
      patients,
      appointmentsToday,
      waitingQueue,
      openEncounters,
      billingTotals,
      departments,
      staffActivity,
      facility,
    ] = await Promise.all([
      prisma.patient.count({
        where: { registeredFacilityId: facilityId, status: "ACTIVE" },
      }),
      prisma.appointment.count({
        where: { facilityId, scheduledAt: { gte: today } },
      }),
      prisma.patientQueue.count({
        where: {
          department: { facilityId },
          status: { in: ["WAITING", "IN_TRIAGE", "WITH_CLINICIAN"] },
        },
      }),
      prisma.encounter.count({
        where: {
          facilityId,
          status: { in: ["DRAFT", "IN_PROGRESS", "AWAITING_LAB"] },
        },
      }),
      prisma.invoice.aggregate({
        where: { facilityId },
        _sum: {
          amountPaid: true,
          balanceDue: true,
          totalAmount: true,
        },
      }),
      prisma.department.findMany({
        where: { facilityId, isActive: true },
        orderBy: { name: "asc" },
        include: {
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
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { actor: true },
      }),
      prisma.facility.findUnique({ where: { id: facilityId } }),
    ])

    const totalRevenue = Number(billingTotals._sum.amountPaid ?? 0)
    const outstanding = Number(billingTotals._sum.balanceDue ?? 0)

    const data: HospitalAdminDashboardData = {
      facilityName: facility?.name ?? "SDA Hospital Kwadaso",
      metrics: [
        {
          label: "Patients",
          value: patients.toString(),
          detail: "Active patient records",
          tone: "green",
        },
        {
          label: "Appointments Today",
          value: appointmentsToday.toString(),
          detail: "Scheduled clinical visits",
          tone: "blue",
        },
        {
          label: "Queue Load",
          value: waitingQueue.toString(),
          detail: "Waiting across departments",
          tone: "orange",
        },
        {
          label: "Revenue",
          value: `GHS ${totalRevenue.toLocaleString()}`,
          detail: `GHS ${outstanding.toLocaleString()} outstanding`,
          tone: "green",
        },
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
        detail:
          log.description ||
          `By ${log.actor?.name ?? log.actor?.email ?? "System"}`,
        timestamp: log.createdAt.toISOString(),
      })),
    }

    return Response.json({
      success: true,
      data,
    } satisfies ApiResponse<HospitalAdminDashboardData>)
  } catch (error) {
    console.error("Failed to load hospital admin dashboard", error)
    return Response.json(
      {
        success: false,
        message: "Hospital admin dashboard could not be loaded.",
      } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
