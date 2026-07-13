import { NextRequest } from "next/server"
import { z } from "zod"

import {
  generateSampleNo,
  laboratoryRequestScope,
  laboratorySampleInclude,
  requireLaboratoryApi,
  serializeLabSample,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabSampleListItem } from "@/types/laboratory"

const schema = z.object({
  sampleType: z.string().trim().min(1),
  notes: z.string().trim().nullable().optional(),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Sample details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 }
    )
  }
  try {
    const labRequest = await prisma.labRequest.findFirst({
      where: { id, ...laboratoryRequestScope(actor!.facilityId) },
      select: { requestNo: true, status: true },
    })
    if (!labRequest) throw new Error("NOT_FOUND")
    if (labRequest.status !== "REQUESTED") throw new Error("INVALID_STATUS")

    let createdId: string | null = null
    for (let attempt = 0; attempt < 3 && !createdId; attempt += 1) {
      try {
        createdId = await prisma.$transaction(
          async (tx) => {
            const changed = await tx.labRequest.updateMany({
              where: {
                id,
                status: "REQUESTED",
                ...laboratoryRequestScope(actor!.facilityId),
              },
              data: { status: "SAMPLE_COLLECTED" },
            })
            if (!changed.count) throw new Error("STALE")

            const sample = await tx.labSample.create({
              data: {
                sampleNo: generateSampleNo(),
                labRequestId: id,
                sampleType: parsed.data.sampleType,
                notes: parsed.data.notes,
                status: "COLLECTED",
                collectedById: actor!.id,
                collectedAt: new Date(),
              },
            })
            await writeLaboratoryAuditLog({
              client: tx,
              request,
              actor: actor!,
              action: "CREATE",
              entityType: "LabSample",
              entityId: sample.id,
              description: `Collected sample ${sample.sampleNo} for request ${labRequest.requestNo}`,
              after: {
                status: sample.status,
                sampleType: sample.sampleType,
                labRequestId: id,
              },
            })
            await writeLaboratoryAuditLog({
              client: tx,
              request,
              actor: actor!,
              action: "UPDATE",
              entityType: "LabRequest",
              entityId: id,
              description: `Marked request ${labRequest.requestNo} as sample collected`,
              before: { status: labRequest.status },
              after: { status: "SAMPLE_COLLECTED" },
            })
            return sample.id
          },
          { maxWait: 5_000, timeout: 15_000 }
        )
      } catch (error) {
        const prismaCode =
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : null
        if (prismaCode === "P2002" && attempt < 2) continue
        throw error
      }
    }
    if (!createdId) throw new Error("NUMBER_GENERATION_FAILED")
    const created = await prisma.labSample.findUniqueOrThrow({
      where: { id: createdId },
      include: laboratorySampleInclude,
    })
    return Response.json(
      {
        success: true,
        data: serializeLabSample(created as never),
      } satisfies ApiResponse<LabSampleListItem>,
      { status: 201 }
    )
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Lab request was not found.", 404],
      INVALID_STATUS: [
        "A new sample can only be collected for a request awaiting collection.",
        409,
      ],
      STALE: ["The request changed while the sample was being collected.", 409],
      NUMBER_GENERATION_FAILED: [
        "A unique sample number could not be generated.",
        500,
      ],
    }
    const [message, status] = map[code] ?? [
      "Sample could not be collected.",
      500,
    ]
    if (!(code in map)) console.error("Failed to collect lab sample", error)
    return Response.json(
      {
        success: false,
        message,
        code: code in map ? code : "SAMPLE_COLLECTION_FAILED",
      },
      { status }
    )
  }
}
