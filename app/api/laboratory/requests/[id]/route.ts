import { NextRequest } from "next/server"
import { z } from "zod"

import {
  canTransitionRequest,
  ensureLaboratoryRequest,
  laboratoryRequestInclude,
  reconcileEncounterAfterLaboratory,
  requireLaboratoryApi,
  serializeLabRequest,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabRequestDetail } from "@/types/laboratory"

const schema = z.object({
  status: z.enum(["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "PARTIAL_RESULT", "COMPLETED", "CANCELLED"]),
  cancellationReason: z.string().trim().min(1).nullable().optional(),
})

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const record = await ensureLaboratoryRequest(id, actor!.facilityId)
  if (!record) return Response.json({ success: false, message: "Lab request was not found." }, { status: 404 })
  const data = await serializeLabRequest(record)
  return Response.json({ success: true, data } satisfies ApiResponse<LabRequestDetail>)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ success: false, message: "Request status update is invalid.", errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 })
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await ensureLaboratoryRequest(id, actor!.facilityId, tx)
      if (!before) throw new Error("NOT_FOUND")
      if (parsed.data.status === "COMPLETED") throw new Error("RELEASE_REQUIRED")
      if (!canTransitionRequest(before.status, parsed.data.status)) throw new Error("INVALID_TRANSITION")
      if (
        parsed.data.status === "PROCESSING" &&
        !before.samples.some((sample) => ["RECEIVED", "PROCESSING", "STORED"].includes(sample.status))
      ) {
        throw new Error("SAMPLE_REQUIRED")
      }
      if (parsed.data.status === "CANCELLED") {
        if (!parsed.data.cancellationReason) throw new Error("REASON_REQUIRED")
        if (before.samples.some((sample) => sample.status !== "PENDING_COLLECTION")) throw new Error("PROCESSING_STARTED")
      }
      const changed = await tx.labRequest.updateMany({
        where: { id, status: before.status },
        data: {
          status: parsed.data.status,
          ...(parsed.data.status === "CANCELLED"
            ? { cancelledAt: new Date(), cancellationReason: parsed.data.cancellationReason }
            : {}),
        },
      })
      if (!changed.count) throw new Error("STALE")
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: parsed.data.status === "CANCELLED" ? "REJECT" : "UPDATE",
        entityType: "LabRequest",
        entityId: id,
        description: `Changed laboratory request ${before.requestNo} from ${before.status} to ${parsed.data.status}`,
        before: { status: before.status },
        after: { status: parsed.data.status, cancellationReason: parsed.data.cancellationReason ?? null },
      })
      if (parsed.data.status === "CANCELLED") {
        await reconcileEncounterAfterLaboratory(tx, before.encounterId, { request, actor: actor! })
      }
      return tx.labRequest.findUniqueOrThrow({ where: { id }, include: laboratoryRequestInclude })
    })
    return Response.json({ success: true, data: await serializeLabRequest(result) } satisfies ApiResponse<LabRequestDetail>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Lab request was not found.", 404],
      RELEASE_REQUIRED: ["A request is completed only after every result is released.", 409],
      INVALID_TRANSITION: ["That request status transition is not allowed.", 409],
      REASON_REQUIRED: ["A cancellation reason is required.", 400],
      SAMPLE_REQUIRED: ["Receive a usable sample before starting laboratory processing.", 409],
      PROCESSING_STARTED: ["The request cannot be cancelled after sample processing starts.", 409],
      STALE: ["The request changed while it was being updated. Refresh and try again.", 409],
    }
    const [message, status] = map[code] ?? ["Lab request could not be updated.", 500]
    return Response.json({ success: false, message, code }, { status })
  }
}
