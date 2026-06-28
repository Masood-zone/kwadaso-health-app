import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireRecordsOfficerApi,
  serializeRecordsAppointment,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  patientId: z.string().trim().min(1),
  departmentId: z.string().trim().min(1),
  clinicianId: z.string().trim().optional().nullable(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(5).max(240),
  title: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(["SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "MISSED", "RESCHEDULED"]),
  cancellationReason: z.string().trim().optional().nullable(),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response
  const { id } = await context.params
  const appointment = await prisma.appointment.findFirst({
    where: { id, facilityId: actor!.facilityId },
    include: { patient: true, department: true, clinician: true },
  })
  if (!appointment) return Response.json({ success: false, message: "Appointment was not found." }, { status: 404 })
  return Response.json({ success: true, data: serializeRecordsAppointment(appointment) } satisfies ApiResponse)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Appointment update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.appointment.findFirst({ where: { id, facilityId: actor!.facilityId } })
  if (!before) return Response.json({ success: false, message: "Appointment was not found." }, { status: 404 })

  const values = parsed.data
  const [patient, department, clinician] = await Promise.all([
    prisma.patient.findFirst({ where: { id: values.patientId, registeredFacilityId: actor!.facilityId } }),
    prisma.department.findFirst({ where: { id: values.departmentId, facilityId: actor!.facilityId } }),
    values.clinicianId ? prisma.user.findFirst({ where: { id: values.clinicianId, facilityId: actor!.facilityId } }) : Promise.resolve(null),
  ])
  if (!patient) return Response.json({ success: false, message: "Patient was not found in this facility." }, { status: 400 })
  if (!department) return Response.json({ success: false, message: "Department was not found in this facility." }, { status: 400 })
  if (values.clinicianId && !clinician) return Response.json({ success: false, message: "Clinician was not found in this facility." }, { status: 400 })

  const statusBecameCheckedIn = values.status === "CHECKED_IN" && before.status !== "CHECKED_IN"
  const statusBecameCancelled = values.status === "CANCELLED" && before.status !== "CANCELLED"

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      patientId: values.patientId,
      departmentId: values.departmentId,
      clinicianId: values.clinicianId || null,
      scheduledAt: new Date(values.scheduledAt),
      durationMinutes: values.durationMinutes,
      title: values.title || null,
      reason: values.reason || null,
      notes: values.notes || null,
      status: values.status,
      updatedById: actor!.id,
      ...(statusBecameCheckedIn ? { checkedInAt: new Date() } : {}),
      ...(statusBecameCancelled
        ? { cancelledAt: new Date(), cancellationReason: values.cancellationReason || null }
        : values.status === "CANCELLED"
          ? { cancellationReason: values.cancellationReason || null }
          : {}),
    },
    include: { patient: true, department: true, clinician: true },
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "Appointment",
    entityId: appointment.id,
    description: `Updated appointment ${appointment.appointmentNo}`,
    before: { status: before.status, scheduledAt: before.scheduledAt },
    after: { status: appointment.status, scheduledAt: appointment.scheduledAt },
  })

  return Response.json({ success: true, data: serializeRecordsAppointment(appointment) } satisfies ApiResponse)
}
