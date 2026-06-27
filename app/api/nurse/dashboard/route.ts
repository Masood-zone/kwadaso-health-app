import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { NurseDashboardData } from "@/types/dashboard"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireRoleApi(request, ["NURSE"])
  if (response) return response

  try {
    const facilityId = staff!.facilityId
    const triageDepartment =
      (await prisma.department.findFirst({
        where: { facilityId, type: "TRIAGE", isActive: true },
      })) ?? staff!.department

    const departmentId = triageDepartment?.id

    const [waiting, inTriage, urgent, queue, vitals, facility] =
      await Promise.all([
        prisma.patientQueue.count({
          where: { departmentId, status: "WAITING" },
        }),
        prisma.patientQueue.count({
          where: { departmentId, status: "IN_TRIAGE" },
        }),
        prisma.patientQueue.count({
          where: {
            departmentId,
            priority: { in: ["URGENT", "EMERGENCY"] },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        }),
        prisma.patientQueue.findMany({
          where: {
            departmentId,
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
          take: 8,
          orderBy: { arrivedAt: "asc" },
          include: { patient: true },
        }),
        prisma.vitalSigns.findMany({
          where: {
            capturedById: staff!.id,
          },
          take: 5,
          orderBy: { capturedAt: "desc" },
          include: { patient: true },
        }),
        prisma.facility.findUnique({ where: { id: facilityId } }),
      ])

    const data: NurseDashboardData = {
      facilityName: facility?.name ?? "SDA Hospital Kwadaso",
      departmentName: triageDepartment?.name ?? "Triage",
      metrics: [
        {
          label: "Waiting",
          value: waiting.toString(),
          detail: "Patients waiting for vitals",
          tone: "orange",
        },
        {
          label: "In Triage",
          value: inTriage.toString(),
          detail: "Patients currently being screened",
          tone: "blue",
        },
        {
          label: "Urgent Cases",
          value: urgent.toString(),
          detail: "Priority and emergency flags",
          tone: "red",
        },
        {
          label: "Recent Vitals",
          value: vitals.length.toString(),
          detail: "Captured by your station",
          tone: "green",
        },
      ],
      triageQueue: queue.map((entry) => ({
        id: entry.id,
        queueNo: entry.queueNo,
        patientName: `${entry.patient.firstName} ${entry.patient.lastName}`,
        patientNo: entry.patient.patientNo,
        priority: entry.priority,
        status: entry.status,
        arrivedAt: entry.arrivedAt.toISOString(),
      })),
      recentVitals: vitals.map((vital) => ({
        id: vital.id,
        patientName: `${vital.patient.firstName} ${vital.patient.lastName}`,
        temperatureC: vital.temperatureC ? Number(vital.temperatureC) : null,
        pulseRate: vital.pulseRate,
        systolicBp: vital.systolicBp,
        diastolicBp: vital.diastolicBp,
        capturedAt: vital.capturedAt.toISOString(),
      })),
    }

    return Response.json({
      success: true,
      data,
    } satisfies ApiResponse<NurseDashboardData>)
  } catch (error) {
    console.error("Failed to load nurse dashboard", error)
    return Response.json(
      {
        success: false,
        message: "Nurse dashboard could not be loaded.",
      } satisfies ApiResponse,
      { status: 500 }
    )
  }
}
