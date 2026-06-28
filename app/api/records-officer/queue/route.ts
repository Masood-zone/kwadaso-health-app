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

const queueSchema = z.object({
  patientId: z.string().trim().min(1),
  appointmentId: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().min(1),
  priority: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]),
  reason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

function dayRange(value?: string | null) {
  const base = value ? new Date(value) : new Date()
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const end = new Date(base)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

async function validateQueueRefs(facilityId: string, patientId: string, departmentId: string, appointmentId?: string | null) {
  const [patient, department, appointment] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, registeredFacilityId: facilityId } }),
    prisma.department.findFirst({ where: { id: departmentId, facilityId } }),
    appointmentId ? prisma.appointment.findFirst({ where: { id: appointmentId, facilityId } }) : Promise.resolve(null),
  ])
  if (!patient) return "Patient was not found in this facility."
  if (!department) return "Department was not found in this facility."
  if (appointmentId && !appointment) return "Appointment was not found in this facility."
  return null
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response
  const searchParams = request.nextUrl.searchParams
  const { start, end } = dayRange(searchParams.get("date"))
  const departmentId = searchParams.get("departmentId")
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")

  const queue = await prisma.patientQueue.findMany({
    where: {
      department: { facilityId: actor!.facilityId },
      arrivedAt: { gte: start, lte: end },
      ...(departmentId ? { departmentId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(priority ? { priority: priority as never } : {}),
    },
    orderBy: { arrivedAt: "asc" },
    include: { patient: true, department: true },
  })

  return Response.json({ success: true, data: queue.map(serializeRecordsQueue) } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response
  const parsed = queueSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Queue details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
  const values = parsed.data
  const validationError = await validateQueueRefs(actor!.facilityId, values.patientId, values.departmentId, values.appointmentId)
  if (validationError) return Response.json({ success: false, message: validationError }, { status: 400 })

  const queue = await prisma.patientQueue.create({
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

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "PatientQueue",
    entityId: queue.id,
    description: `Added ${queue.queueNo} to queue`,
    after: { queueNo: queue.queueNo, patientId: queue.patientId, departmentId: queue.departmentId },
  })

  return Response.json(
    { success: true, data: serializeRecordsQueue(queue) } satisfies ApiResponse,
    { status: 201 }
  )
}
