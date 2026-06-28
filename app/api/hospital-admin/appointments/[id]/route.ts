import { NextRequest } from "next/server"
import { z } from "zod"

import {
  clinicalAppointmentRoles,
  requireHospitalAdminApi,
  serializeHospitalAdminAppointment,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const appointmentSchema = z.object({
  patientId: z.string().trim().min(1),
  departmentId: z.string().trim().min(1),
  clinicianId: z.string().trim().optional().nullable(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(5).max(240),
  title: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum([
    "SCHEDULED",
    "CHECKED_IN",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "MISSED",
    "RESCHEDULED",
  ]),
  cancellationReason: z.string().trim().optional().nullable(),
})

async function validateAppointmentRefs({
  facilityId,
  patientId,
  departmentId,
  clinicianId,
}: {
  facilityId: string
  patientId: string
  departmentId: string
  clinicianId?: string | null
}) {
  const [patient, department, clinician] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: patientId, registeredFacilityId: facilityId },
    }),
    prisma.department.findFirst({
      where: { id: departmentId, facilityId },
    }),
    clinicianId
      ? prisma.user.findFirst({
          where: {
            id: clinicianId,
            facilityId,
            defaultRole: { in: [...clinicalAppointmentRoles] },
          },
        })
      : Promise.resolve(null),
  ])

  if (!patient) return "Patient was not found in this facility."
  if (!department) return "Department was not found in this facility."
  if (clinicianId && !clinician) {
    return "Clinician was not found in this facility or is not a clinical role."
  }

  return null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const { id } = await context.params
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

  const before = await prisma.appointment.findFirst({
    where: { id, facilityId: actor!.facilityId },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Appointment was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  const validationError = await validateAppointmentRefs({
    facilityId: actor!.facilityId,
    patientId: values.patientId,
    departmentId: values.departmentId,
    clinicianId: values.clinicianId,
  })
  if (validationError) {
    return Response.json(
      { success: false, message: validationError },
      { status: 400 }
    )
  }

  const statusBecameCheckedIn =
    values.status === "CHECKED_IN" && before.status !== "CHECKED_IN"
  const statusBecameCancelled =
    values.status === "CANCELLED" && before.status !== "CANCELLED"

  const updated = await prisma.appointment.update({
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
        ? {
            cancelledAt: new Date(),
            cancellationReason: values.cancellationReason || null,
          }
        : values.status === "CANCELLED"
          ? { cancellationReason: values.cancellationReason || null }
          : {}),
    },
    include: { patient: true, department: true, clinician: true },
  })

  await writeHospitalAdminAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "Appointment",
    entityId: updated.id,
    description: `Updated appointment ${updated.appointmentNo}`,
    before: {
      scheduledAt: before.scheduledAt,
      status: before.status,
      patientId: before.patientId,
      departmentId: before.departmentId,
      clinicianId: before.clinicianId,
    },
    after: {
      scheduledAt: updated.scheduledAt,
      status: updated.status,
      patientId: updated.patientId,
      departmentId: updated.departmentId,
      clinicianId: updated.clinicianId,
      previousScheduledAt: before.scheduledAt,
    },
  })

  return Response.json({
    success: true,
    data: serializeHospitalAdminAppointment(updated),
  } satisfies ApiResponse)
}
