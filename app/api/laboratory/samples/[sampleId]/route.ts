import { NextRequest } from "next/server"
import { z } from "zod"

import {
  canTransitionSample,
  ensureLaboratorySample,
  laboratoryRequestScope,
  laboratorySampleInclude,
  requireLaboratoryApi,
  serializeLabSampleDetail,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabSampleDetail } from "@/types/laboratory"

const schema = z.object({
  status: z.enum([
    "PENDING_COLLECTION",
    "COLLECTED",
    "RECEIVED",
    "REJECTED",
    "PROCESSING",
    "STORED",
    "DISPOSED",
  ]),
  notes: z.string().trim().nullable().optional(),
  rejectionReason: z.string().trim().min(1).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sampleId: string }> }
) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { sampleId } = await context.params
  const sample = await ensureLaboratorySample(sampleId, actor!.facilityId)
  if (!sample)
    return Response.json(
      { success: false, message: "Sample was not found." },
      { status: 404 }
    )
  return Response.json({
    success: true,
    data: await serializeLabSampleDetail(sample),
  } satisfies ApiResponse<LabSampleDetail>)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sampleId: string }> }
) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { sampleId } = await context.params
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Sample update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    )
  }
  try {
    const before = await prisma.labSample.findFirst({
      where: {
        id: sampleId,
        labRequest: laboratoryRequestScope(actor!.facilityId),
      },
      select: {
        id: true,
        status: true,
        notes: true,
        sampleNo: true,
        labRequestId: true,
        labRequest: { select: { requestedById: true } },
      },
    })
    if (!before) throw new Error("NOT_FOUND")
    if (!canTransitionSample(before.status, parsed.data.status))
      throw new Error("INVALID_TRANSITION")
    if (parsed.data.status === "REJECTED" && !parsed.data.rejectionReason)
      throw new Error("REASON_REQUIRED")

    const updatedId = await prisma.$transaction(
      async (tx) => {
        const changed = await tx.labSample.updateMany({
          where: {
            id: sampleId,
            status: before.status,
            labRequest: laboratoryRequestScope(actor!.facilityId),
          },
          data: {
            status: parsed.data.status,
            notes: parsed.data.notes,
            ...(parsed.data.status === "RECEIVED"
              ? { receivedById: actor!.id, receivedAt: new Date() }
              : {}),
            ...(parsed.data.status === "REJECTED"
              ? { rejectionReason: parsed.data.rejectionReason }
              : {}),
          },
        })
        if (!changed.count) throw new Error("STALE")
        if (parsed.data.status === "PROCESSING") {
          await tx.labRequest.updateMany({
            where: { id: before.labRequestId, status: "SAMPLE_COLLECTED" },
            data: { status: "PROCESSING" },
          })
        }
        if (parsed.data.status === "REJECTED") {
          const usableSamples = await tx.labSample.count({
            where: {
              labRequestId: before.labRequestId,
              id: { not: sampleId },
              status: { notIn: ["REJECTED", "DISPOSED"] },
            },
          })
          const results = await tx.labResult.count({
            where: { requestTest: { labRequestId: before.labRequestId } },
          })
          if (!usableSamples && !results) {
            await tx.labRequest.updateMany({
              where: {
                id: before.labRequestId,
                status: "SAMPLE_COLLECTED",
              },
              data: { status: "REQUESTED" },
            })
          }
          if (before.labRequest.requestedById) {
            await tx.notification.create({
              data: {
                recipientId: before.labRequest.requestedById,
                facilityId: actor!.facilityId,
                createdById: actor!.id,
                type: "LAB_RESULT",
                priority: "HIGH",
                title: `Sample ${before.sampleNo} rejected`,
                body: parsed.data.rejectionReason,
                actionUrl: `/clinician/lab-requests`,
                entityType: "LabSample",
                entityId: sampleId,
              },
            })
          }
        }
        await writeLaboratoryAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: parsed.data.status === "REJECTED" ? "REJECT" : "UPDATE",
          entityType: "LabSample",
          entityId: sampleId,
          description: `Changed sample ${before.sampleNo} from ${before.status} to ${parsed.data.status}`,
          before: { status: before.status, notes: before.notes },
          after: {
            status: parsed.data.status,
            notes: parsed.data.notes ?? null,
            rejectionReason: parsed.data.rejectionReason ?? null,
          },
        })
        return sampleId
      },
      { maxWait: 5_000, timeout: 15_000 }
    )
    const updated = await prisma.labSample.findUniqueOrThrow({
      where: { id: updatedId },
      include: laboratorySampleInclude,
    })
    return Response.json({
      success: true,
      data: await serializeLabSampleDetail(updated),
    } satisfies ApiResponse<LabSampleDetail>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Sample was not found.", 404],
      INVALID_TRANSITION: [
        "That sample status transition is not allowed.",
        409,
      ],
      REASON_REQUIRED: ["A rejection reason is required.", 400],
      STALE: [
        "The sample changed while it was being updated. Refresh and try again.",
        409,
      ],
    }
    const [message, status] = map[code] ?? ["Sample could not be updated.", 500]
    if (!(code in map)) console.error("Failed to update lab sample", error)
    return Response.json(
      {
        success: false,
        message,
        code: code in map ? code : "SAMPLE_UPDATE_FAILED",
      },
      { status }
    )
  }
}
