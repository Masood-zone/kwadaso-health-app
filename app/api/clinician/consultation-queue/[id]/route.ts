import type { NextRequest } from "next/server"

import { canTransitionQueue, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { clinicianQueueInclude, serializeQueue } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { queueUpdateSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = queueUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.patientQueue.findFirst({ where: { id, department: { facilityId: actor.facilityId } } })
      if (!before) throw new Error("QUEUE_NOT_FOUND")
      if (before.assignedToId && before.assignedToId !== actor.id) throw new Error("QUEUE_CLAIMED")
      if (!canTransitionQueue(before.status, parsed.data.status)) throw new Error("INVALID_QUEUE_TRANSITION")
      if (parsed.data.status === "CANCELLED" && !parsed.data.cancellationReason) throw new Error("CANCELLATION_REASON_REQUIRED")
      const claimed = await tx.patientQueue.updateMany({ where: { id, OR: [{ assignedToId: null }, { assignedToId: actor.id }] }, data: { assignedToId: actor.id } })
      if (claimed.count !== 1) throw new Error("QUEUE_CLAIMED")
      const updated = await tx.patientQueue.update({
        where: { id },
        data: {
          status: parsed.data.status,
          notes: parsed.data.notes,
          ...(parsed.data.status === "WITH_CLINICIAN" ? { calledAt: before.calledAt ?? new Date() } : {}),
          ...(parsed.data.status === "COMPLETED" ? { completedAt: before.completedAt ?? new Date() } : {}),
          ...(parsed.data.status === "CANCELLED" ? { cancelledAt: before.cancelledAt ?? new Date(), cancellationReason: parsed.data.cancellationReason } : {}),
        },
        include: clinicianQueueInclude,
      })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "PatientQueue", entityId: id, description: `Updated queue ${updated.queueNo} to ${updated.status}`, before: { status: before.status }, after: { status: updated.status } })
      return updated
    })
    return ok(serializeQueue(row, actor.id))
  })
}
