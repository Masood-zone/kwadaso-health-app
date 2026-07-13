import { NextRequest } from "next/server"
import { z } from "zod"

import {
  generateAppointmentNo,
  requireRecordsOfficerApi,
  serializeRecordsAppointment,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import { notifyBillingService } from "@/lib/billing"

const appointmentSchema = z.object({
  patientId: z.string().trim().min(1),
  departmentId: z.string().trim().min(1),
  clinicianId: z.string().trim().optional().nullable(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(5).max(240),
  title: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

async function validateRefs(facilityId: string, patientId: string, departmentId: string, clinicianId?: string | null) {
  const [patient, department, clinician] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, registeredFacilityId: facilityId } }),
    prisma.department.findFirst({ where: { id: departmentId, facilityId } }),
    clinicianId ? prisma.user.findFirst({ where: { id: clinicianId, facilityId } }) : Promise.resolve(null),
  ])
  if (!patient) return "Patient was not found in this facility."
  if (!department) return "Department was not found in this facility."
  if (clinicianId && !clinician) return "Clinician was not found in this facility."
  return null
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const status = searchParams.get("status")
  const departmentId = searchParams.get("departmentId")
  const clinicianId = searchParams.get("clinicianId")
  const patientSearch = searchParams.get("patientSearch")?.trim()

  const appointments = await prisma.appointment.findMany({
    where: {
      facilityId: actor!.facilityId,
      ...(dateFrom || dateTo
        ? { scheduledAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
        : {}),
      ...(status ? { status: status as never } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(clinicianId ? { clinicianId } : {}),
      ...(patientSearch
        ? {
            patient: {
              OR: [
                { firstName: { contains: patientSearch, mode: "insensitive" } },
                { lastName: { contains: patientSearch, mode: "insensitive" } },
                { patientNo: { contains: patientSearch, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: { scheduledAt: "desc" },
    include: { patient: true, department: true, clinician: true },
  })

  return Response.json({ success: true, data: appointments.map(serializeRecordsAppointment) } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const parsed = appointmentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Appointment details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const values = parsed.data
  const validationError = await validateRefs(actor!.facilityId, values.patientId, values.departmentId, values.clinicianId)
  if (validationError) return Response.json({ success: false, message: validationError }, { status: 400 })

  const appointment = await prisma.appointment.create({
    data: {
      appointmentNo: await generateAppointmentNo(),
      patientId: values.patientId,
      facilityId: actor!.facilityId,
      departmentId: values.departmentId,
      clinicianId: values.clinicianId || null,
      scheduledAt: new Date(values.scheduledAt),
      durationMinutes: values.durationMinutes,
      title: values.title || null,
      reason: values.reason || null,
      notes: values.notes || null,
      status: "SCHEDULED",
      createdById: actor!.id,
      updatedById: actor!.id,
    },
    include: { patient: true, department: true, clinician: true },
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "Appointment",
    entityId: appointment.id,
    description: `Booked appointment ${appointment.appointmentNo}`,
    after: { appointmentNo: appointment.appointmentNo, patientId: appointment.patientId },
  })
  await notifyBillingService(prisma, { facilityId: actor!.facilityId, createdById: actor!.id, entityType: "Appointment", entityId: appointment.id, title: "Appointment available for billing review", body: `${appointment.appointmentNo} was booked for ${appointment.patient.patientNo}.` })

  return Response.json(
    { success: true, data: serializeRecordsAppointment(appointment) } satisfies ApiResponse,
    { status: 201 }
  )
}
