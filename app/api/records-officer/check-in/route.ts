import { NextRequest } from "next/server"
import { z } from "zod"

import {
  generateQueueNo,
  requireRecordsOfficerApi,
  serializeRecordsQueue,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const checkInSchema = z.object({
  patientId: z.string().trim().min(1),
  appointmentId: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().min(1),
  priority: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]),
  reason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const parsed = checkInSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Check-in details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const values = parsed.data
  const [patient, department, appointment] = await Promise.all([
    prisma.patient.findFirst({ where: { id: values.patientId, registeredFacilityId: actor!.facilityId } }),
    prisma.department.findFirst({ where: { id: values.departmentId, facilityId: actor!.facilityId } }),
    values.appointmentId ? prisma.appointment.findFirst({ where: { id: values.appointmentId, facilityId: actor!.facilityId } }) : Promise.resolve(null),
  ])

  if (!patient) return Response.json({ success: false, message: "Patient was not found in this facility." }, { status: 400 })
  if (!department) return Response.json({ success: false, message: "Department was not found in this facility." }, { status: 400 })
  if (values.appointmentId && !appointment) return Response.json({ success: false, message: "Appointment was not found in this facility." }, { status: 400 })

  const queue = await prisma.$transaction(async (tx) => {
    if (values.appointmentId) {
      await tx.appointment.update({
        where: { id: values.appointmentId },
        data: { status: "CHECKED_IN", checkedInAt: new Date(), updatedById: actor!.id },
      })
    }

    return tx.patientQueue.create({
      data: {
        queueNo: await generateQueueNo(values.departmentId),
        patientId: values.patientId,
        appointmentId: values.appointmentId || null,
        departmentId: values.departmentId,
        priority: values.priority,
        reason: values.reason || null,
        notes: values.notes || null,
        status: "WAITING",
      },
      include: { patient: true, department: true },
    })
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "PatientCheckIn",
    entityId: queue.id,
    description: `Checked in patient ${patient.patientNo} and created queue ${queue.queueNo}`,
    after: {
      patientId: values.patientId,
      appointmentId: values.appointmentId ?? null,
      queueNo: queue.queueNo,
      departmentId: values.departmentId,
    },
  })

  return Response.json(
    { success: true, data: serializeRecordsQueue(queue) } satisfies ApiResponse,
    { status: 201 }
  )
}
