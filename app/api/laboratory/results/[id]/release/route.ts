import { NextRequest } from "next/server"
import { z } from "zod"

import {
  ensureLaboratoryResult,
  laboratoryResultInclude,
  reconcileEncounterAfterLaboratory,
  requireLaboratoryApi,
  serializeLabResult,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabResultDetail } from "@/types/laboratory"

const schema = z.object({ note: z.string().trim().nullable().optional() })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ success: false, message: "Release request is invalid." }, { status: 400 })
  try {
    await prisma.$transaction(async (tx) => {
      const before = await ensureLaboratoryResult(id, actor!.facilityId, tx)
      if (!before) throw new Error("NOT_FOUND")
      if (before.status !== "VALIDATED") throw new Error("VALIDATION_REQUIRED")
      const changed = await tx.labResult.updateMany({
        where: { id, status: "VALIDATED" },
        data: { status: "RELEASED", releasedAt: new Date(), validationNote: parsed.data.note ?? before.validationNote },
      })
      if (!changed.count) throw new Error("STALE")
      if (before.requestTest.labRequest.requestedById) {
        await tx.notification.create({
          data: {
            recipientId: before.requestTest.labRequest.requestedById,
            facilityId: actor!.facilityId,
            createdById: actor!.id,
            type: "LAB_RESULT",
            priority: before.criticalFlag ? "URGENT" : "NORMAL",
            title: `${before.test.name} result released`,
            body: `Result ${before.resultNo} is available in the patient record.`,
            actionUrl: "/clinician/lab-requests",
            entityType: "LabResult",
            entityId: id,
          },
        })
      }
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "SEND",
        entityType: "LabResult",
        entityId: id,
        description: `Released result ${before.resultNo} to the ordering clinician`,
        before: { status: before.status },
        after: { status: "RELEASED", note: parsed.data.note ?? null },
      })
      const incomplete = await tx.labRequestTest.count({
        where: { labRequestId: before.requestTest.labRequestId, OR: [{ result: null }, { result: { status: { not: "RELEASED" } } }] },
      })
      if (!incomplete) {
        const completed = await tx.labRequest.update({
          where: { id: before.requestTest.labRequestId },
          data: { status: "COMPLETED", completedAt: new Date() },
        })
        await writeLaboratoryAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: "UPDATE",
          entityType: "LabRequest",
          entityId: completed.id,
          description: `Completed laboratory request ${completed.requestNo}`,
          before: { status: before.requestTest.labRequest.status },
          after: { status: "COMPLETED" },
        })
        await reconcileEncounterAfterLaboratory(tx, completed.encounterId, { request, actor: actor! })
      }
    })
    const result = await prisma.labResult.findUniqueOrThrow({ where: { id }, include: laboratoryResultInclude })
    return Response.json({ success: true, data: await serializeLabResult(result) } satisfies ApiResponse<LabResultDetail>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Result was not found.", 404],
      VALIDATION_REQUIRED: ["Only validated results can be released.", 409],
      STALE: ["The result changed while it was being released. Refresh and try again.", 409],
    }
    const [message, status] = map[code] ?? ["Result could not be released.", 500]
    return Response.json({ success: false, message, code }, { status })
  }
}
