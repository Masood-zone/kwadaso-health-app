import { NextRequest } from "next/server"

import {
  requireNurseApi,
  serializeImmunization,
  serializeQueueEntry,
  serializeVitalSigns,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { NurseDashboardSummary } from "@/types/nurse"

export async function GET(request: NextRequest) {
  const { staff, response } = await requireNurseApi(request)
  if (response) return response

  try {
    const facilityId = staff!.facilityId
    const triageDepartment =
      (await prisma.department.findFirst({
        where: { facilityId, type: "TRIAGE", isActive: true },
      })) ?? staff!.department

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [waiting, inTriage, emergency, withClinician, vitalsToday, immunizationsToday, queue, emergencyQueue, vitals, immunizations, facility] =
      await Promise.all([
        prisma.patientQueue.count({
          where: { department: { facilityId }, status: "WAITING" },
        }),
        prisma.patientQueue.count({
          where: { department: { facilityId }, status: "IN_TRIAGE" },
        }),
        prisma.patientQueue.count({
          where: {
            department: { facilityId },
            priority: "EMERGENCY",
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        }),
        prisma.patientQueue.count({
          where: { department: { facilityId }, status: "WITH_CLINICIAN" },
        }),
        prisma.vitalSigns.count({
          where: {
            patient: { registeredFacilityId: facilityId },
            capturedAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        prisma.immunizationRecord.count({
          where: {
            patient: { registeredFacilityId: facilityId },
            administeredAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        prisma.patientQueue.findMany({
          where: {
            department: { facilityId },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
          take: 8,
          orderBy: { arrivedAt: "asc" },
          include: {
            department: true,
            patient: { include: { vitalSigns: { take: 1, orderBy: { capturedAt: "desc" } } } },
          },
        }),
        prisma.patientQueue.findMany({
          where: {
            department: { facilityId },
            priority: "EMERGENCY",
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
          take: 6,
          orderBy: { arrivedAt: "asc" },
          include: {
            department: true,
            patient: { include: { vitalSigns: { take: 1, orderBy: { capturedAt: "desc" } } } },
          },
        }),
        prisma.vitalSigns.findMany({
          where: {
            patient: { registeredFacilityId: facilityId },
          },
          take: 5,
          orderBy: { capturedAt: "desc" },
          include: { patient: true, capturedBy: true },
        }),
        prisma.immunizationRecord.findMany({
          where: {
            patient: { registeredFacilityId: facilityId },
          },
          take: 5,
          orderBy: { administeredAt: "desc" },
          include: { patient: true, administeredBy: true },
        }),
        prisma.facility.findUnique({ where: { id: facilityId } }),
      ])

    const averageWaitingMinutes = queue.length
      ? Math.round(
          queue.reduce(
            (total, entry) => total + (Date.now() - entry.arrivedAt.getTime()) / 60000,
            0
          ) / queue.length
        )
      : 0

    const data: NurseDashboardSummary = {
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
          label: "Emergency",
          value: emergency.toString(),
          detail: "Patients needing immediate attention",
          tone: "red",
        },
        {
          label: "Sent To Clinician",
          value: withClinician.toString(),
          detail: "Completed triage handoffs",
          tone: "green",
        },
        {
          label: "Vitals Today",
          value: vitalsToday.toString(),
          detail: "Captured across triage",
          tone: "blue",
        },
        {
          label: "Immunizations",
          value: immunizationsToday.toString(),
          detail: "Recorded today",
          tone: "green",
        },
        {
          label: "Avg Wait",
          value: `${averageWaitingMinutes}m`,
          detail: "Current active queue average",
          tone: "orange",
        },
      ],
      triageQueue: queue.map(serializeQueueEntry),
      emergencyPatients: emergencyQueue.map(serializeQueueEntry),
      recentVitals: vitals.map(serializeVitalSigns),
      recentImmunizations: immunizations.map(serializeImmunization),
    }

    return Response.json({
      success: true,
      data,
    } satisfies ApiResponse<NurseDashboardSummary>)
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
