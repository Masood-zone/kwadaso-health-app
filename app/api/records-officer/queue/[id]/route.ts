import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireRecordsOfficerApi,
  serializeRecordsQueue,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  priority: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]),
  status: z.enum(["WAITING", "IN_TRIAGE", "CANCELLED"]),
  notes: z.string().trim().optional().nullable(),
  cancellationReason: z.string().trim().optional().nullable(),
})

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
        message: "Queue update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.patientQueue.findFirst({
    where: { id, department: { facilityId: actor!.facilityId } },
  })
  if (!before) return Response.json({ success: false, message: "Queue item was not found." }, { status: 404 })

  if (!["WAITING", "IN_TRIAGE", "CANCELLED"].includes(before.status)) {
    return Response.json(
      { success: false, message: "Records Officer cannot update this queue item after clinical service has started." },
      { status: 403 }
    )
  }

  const values = parsed.data
  const queue = await prisma.patientQueue.update({
    where: { id },
    data: {
      priority: values.priority,
      status: values.status,
      notes: values.notes || null,
      ...(values.status === "CANCELLED"
        ? {
            cancelledAt: before.cancelledAt ?? new Date(),
            cancellationReason: values.cancellationReason || null,
          }
        : {}),
    },
    include: { patient: true, department: true },
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "PatientQueue",
    entityId: queue.id,
    description: `Updated queue item ${queue.queueNo}`,
    before: { priority: before.priority, status: before.status },
    after: { priority: queue.priority, status: queue.status },
  })

  return Response.json({ success: true, data: serializeRecordsQueue(queue) } satisfies ApiResponse)
}
