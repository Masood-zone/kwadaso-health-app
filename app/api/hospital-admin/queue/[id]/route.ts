import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireHospitalAdminApi,
  serializeHospitalAdminQueueItem,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const queueUpdateSchema = z.object({
  assignedToId: z.string().trim().optional().nullable(),
  priority: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]),
  status: z.enum([
    "WAITING",
    "IN_TRIAGE",
    "WITH_CLINICIAN",
    "AWAITING_LAB",
    "AWAITING_PHARMACY",
    "COMPLETED",
    "CANCELLED",
  ]),
  reason: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  cancellationReason: z.string().trim().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const { id } = await context.params
  const parsed = queueUpdateSchema.safeParse(await request.json())
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

  const before = await prisma.patientQueue.findFirst({
    where: { id, department: { facilityId: actor!.facilityId } },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Queue item was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  if (values.assignedToId) {
    const assignedTo = await prisma.user.findFirst({
      where: { id: values.assignedToId, facilityId: actor!.facilityId },
    })
    if (!assignedTo) {
      return Response.json(
        {
          success: false,
          message: "Assigned staff member was not found in this facility.",
        },
        { status: 400 }
      )
    }
  }

  const statusBecameCalled =
    values.status === "WITH_CLINICIAN" && before.status !== "WITH_CLINICIAN"
  const statusBecameCompleted =
    values.status === "COMPLETED" && before.status !== "COMPLETED"
  const statusBecameCancelled =
    values.status === "CANCELLED" && before.status !== "CANCELLED"

  const queue = await prisma.patientQueue.update({
    where: { id },
    data: {
      assignedToId: values.assignedToId || null,
      priority: values.priority,
      status: values.status,
      reason: values.reason || null,
      notes: values.notes || null,
      ...(statusBecameCalled ? { calledAt: new Date() } : {}),
      ...(statusBecameCompleted ? { completedAt: new Date() } : {}),
      ...(statusBecameCancelled
        ? {
            cancelledAt: new Date(),
            cancellationReason: values.cancellationReason || null,
          }
        : values.status === "CANCELLED"
          ? { cancellationReason: values.cancellationReason || null }
          : {}),
    },
    include: { patient: true, department: true, assignedTo: true },
  })

  await writeHospitalAdminAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "PatientQueue",
    entityId: queue.id,
    description: `Updated queue item ${queue.queueNo}`,
    before: {
      priority: before.priority,
      status: before.status,
      assignedToId: before.assignedToId,
    },
    after: {
      priority: queue.priority,
      status: queue.status,
      assignedToId: queue.assignedToId,
      calledAt: queue.calledAt,
      completedAt: queue.completedAt,
      cancelledAt: queue.cancelledAt,
    },
  })

  return Response.json({
    success: true,
    data: serializeHospitalAdminQueueItem(queue),
  } satisfies ApiResponse)
}
