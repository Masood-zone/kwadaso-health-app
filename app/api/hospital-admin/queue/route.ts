import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireHospitalAdminApi,
  serializeHospitalAdminQueueItem,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const queueCreateSchema = z.object({
  patientId: z.string().trim().min(1),
  appointmentId: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().min(1),
  assignedToId: z.string().trim().optional().nullable(),
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

async function validateQueueRefs({
  facilityId,
  patientId,
  appointmentId,
  departmentId,
  assignedToId,
}: {
  facilityId: string
  patientId: string
  appointmentId?: string | null
  departmentId: string
  assignedToId?: string | null
}) {
  const [patient, appointment, department, assignedTo] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: patientId, registeredFacilityId: facilityId },
    }),
    appointmentId
      ? prisma.appointment.findFirst({
          where: { id: appointmentId, facilityId },
        })
      : Promise.resolve(null),
    prisma.department.findFirst({ where: { id: departmentId, facilityId } }),
    assignedToId
      ? prisma.user.findFirst({ where: { id: assignedToId, facilityId } })
      : Promise.resolve(null),
  ])

  if (!patient) return "Patient was not found in this facility."
  if (appointmentId && !appointment) {
    return "Appointment was not found in this facility."
  }
  if (!department) return "Department was not found in this facility."
  if (assignedToId && !assignedTo) {
    return "Assigned staff member was not found in this facility."
  }

  return null
}

async function createQueueNo(departmentId: string) {
  const { start, end } = dayRange()
  const count = await prisma.patientQueue.count({
    where: { departmentId, arrivedAt: { gte: start, lte: end } },
  })
  return `Q-${String(count + 1).padStart(3, "0")}`
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
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
    include: { patient: true, department: true, assignedTo: true },
  })

  return Response.json({
    success: true,
    data: queue.map(serializeHospitalAdminQueueItem),
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const parsed = queueCreateSchema.safeParse(await request.json())
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
  const validationError = await validateQueueRefs({
    facilityId: actor!.facilityId,
    patientId: values.patientId,
    appointmentId: values.appointmentId,
    departmentId: values.departmentId,
    assignedToId: values.assignedToId,
  })
  if (validationError) {
    return Response.json(
      { success: false, message: validationError },
      { status: 400 }
    )
  }

  const queue = await prisma.patientQueue.create({
    data: {
      queueNo: await createQueueNo(values.departmentId),
      patientId: values.patientId,
      appointmentId: values.appointmentId || null,
      departmentId: values.departmentId,
      assignedToId: values.assignedToId || null,
      priority: values.priority,
      reason: values.reason || null,
      notes: values.notes || null,
    },
    include: { patient: true, department: true, assignedTo: true },
  })

  await writeHospitalAdminAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "PatientQueue",
    entityId: queue.id,
    description: `Added ${queue.queueNo} to queue`,
    after: {
      queueNo: queue.queueNo,
      patientId: queue.patientId,
      departmentId: queue.departmentId,
      priority: queue.priority,
      status: queue.status,
    },
  })

  return Response.json(
    {
      success: true,
      data: serializeHospitalAdminQueueItem(queue),
    } satisfies ApiResponse,
    { status: 201 }
  )
}
