import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireNurseApi,
  serializeQueueEntry,
  writeNurseAuditLog,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  status: z
    .enum(["WAITING", "IN_TRIAGE", "WITH_CLINICIAN", "CANCELLED"])
    .optional(),
  priority: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]).optional(),
  notes: z.string().trim().optional().nullable(),
  cancellationReason: z.string().trim().optional().nullable(),
})

const allowedTransitions = new Set([
  "WAITING->IN_TRIAGE",
  "IN_TRIAGE->WITH_CLINICIAN",
  "WAITING->CANCELLED",
  "IN_TRIAGE->CANCELLED",
])

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Queue update is invalid.",
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

  const nextStatus = parsed.data.status ?? before.status
  if (nextStatus !== before.status) {
    const key = `${before.status}->${nextStatus}`
    if (!allowedTransitions.has(key)) {
      return Response.json(
        {
          success: false,
          message: "Nurse cannot perform this queue status transition.",
        },
        { status: 403 }
      )
    }
  }

  const queue = await prisma.patientQueue.update({
    where: { id },
    data: {
      priority: parsed.data.priority ?? before.priority,
      status: nextStatus,
      notes: parsed.data.notes ?? before.notes,
      ...(nextStatus === "WITH_CLINICIAN" ? { calledAt: before.calledAt ?? new Date() } : {}),
      ...(nextStatus === "CANCELLED"
        ? {
            cancelledAt: before.cancelledAt ?? new Date(),
            cancellationReason: parsed.data.cancellationReason ?? before.cancellationReason,
          }
        : {}),
    },
    include: {
      department: true,
      patient: {
        include: {
          vitalSigns: { take: 1, orderBy: { capturedAt: "desc" } },
        },
      },
    },
  })

  await writeNurseAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "PatientQueue",
    entityId: queue.id,
    description: `Nurse updated queue item ${queue.queueNo}`,
    before: { status: before.status, priority: before.priority, notes: before.notes },
    after: { status: queue.status, priority: queue.priority, notes: queue.notes },
  })

  return Response.json({
    success: true,
    data: serializeQueueEntry(queue),
  } satisfies ApiResponse)
}
