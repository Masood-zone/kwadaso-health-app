import { NextRequest } from "next/server"

import {
  calculateParameterFlags,
  ensureLaboratoryResult,
  laboratoryResultInclude,
  requireLaboratoryApi,
  serializeLabResult,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import { laboratoryResultPayloadSchema } from "@/lib/laboratory-schemas"
import type { ApiResponse } from "@/types"
import type { LabResultDetail } from "@/types/laboratory"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const result = await ensureLaboratoryResult(id, actor!.facilityId)
  if (!result) return Response.json({ success: false, message: "Result was not found." }, { status: 404 })
  return Response.json({ success: true, data: await serializeLabResult(result) } satisfies ApiResponse<LabResultDetail>)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = laboratoryResultPayloadSchema.partial().safeParse(await request.json())
  if (!parsed.success) return Response.json({ success: false, message: "Result update is invalid." }, { status: 400 })
  try {
    await prisma.$transaction(async (tx) => {
      const before = await ensureLaboratoryResult(id, actor!.facilityId, tx)
      if (!before) throw new Error("NOT_FOUND")
      if (!["DRAFT", "ENTERED", "REJECTED"].includes(before.status)) throw new Error("IMMUTABLE")
      const status = parsed.data.status ?? (before.status === "REJECTED" ? "DRAFT" : before.status)
      const sampleId = parsed.data.labSampleId ?? before.labSampleId
      const sample = sampleId
        ? await tx.labSample.findFirst({
            where: { id: sampleId, labRequestId: before.requestTest.labRequestId, status: { in: ["RECEIVED", "PROCESSING", "STORED"] } },
          })
        : null
      if (!sample) throw new Error("SAMPLE_REQUIRED")
      const sourceParameters = parsed.data.parameters ?? before.items.map((item) => ({
        parameterDefinitionId: item.parameterDefinitionId,
        parameterName: item.parameterName,
        value: item.value,
        unit: item.unit,
        referenceRange: item.referenceRange,
        isAbnormal: item.isAbnormal,
        isCritical: item.isCritical,
      }))
      const definitions = new Map(before.test.parameterDefinitions.map((item) => [item.id, item]))
      const parameters = sourceParameters.map((parameter) => {
        const definition = parameter.parameterDefinitionId ? definitions.get(parameter.parameterDefinitionId) : undefined
        if (parameter.parameterDefinitionId && !definition) throw new Error("PARAMETER_INVALID")
        return {
          parameterDefinitionId: definition?.id ?? null,
          parameterName: definition?.name ?? parameter.parameterName,
          value: parameter.value,
          unit: parameter.unit ?? definition?.unit,
          referenceRange: parameter.referenceRange ?? definition?.referenceRange,
          ...calculateParameterFlags(parameter.value, definition, parameter),
        }
      })
      const abnormalFlag = Boolean(parsed.data.abnormalFlag || parameters.some((item) => item.isAbnormal))
      const criticalFlag = Boolean(parsed.data.criticalFlag || parameters.some((item) => item.isCritical))
      const changed = await tx.labResult.updateMany({
        where: { id, status: before.status },
        data: {
          labSampleId: sample.id,
          status,
          resultText: parsed.data.resultText === undefined ? before.resultText : parsed.data.resultText,
          notes: parsed.data.notes === undefined ? before.notes : parsed.data.notes,
          abnormalFlag,
          criticalFlag,
          enteredById: actor!.id,
          enteredAt: status === "ENTERED" ? new Date() : before.enteredAt,
          validationNote: before.status === "REJECTED" ? null : before.validationNote,
        },
      })
      if (!changed.count) throw new Error("STALE")
      await tx.labResultItem.deleteMany({ where: { labResultId: id } })
      if (parameters.length) await tx.labResultItem.createMany({ data: parameters.map((item) => ({ ...item, labResultId: id })) })
      if (status === "ENTERED") {
        await tx.labRequest.updateMany({ where: { id: before.requestTest.labRequestId, status: { in: ["SAMPLE_COLLECTED", "PROCESSING"] } }, data: { status: "PARTIAL_RESULT" } })
      }
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "UPDATE",
        entityType: "LabResult",
        entityId: id,
        description: `Updated result ${before.resultNo}`,
        before: { status: before.status, abnormalFlag: before.abnormalFlag, criticalFlag: before.criticalFlag, parameterCount: before.items.length },
        after: { status, abnormalFlag, criticalFlag, parameterCount: parameters.length },
      })
    })
    const result = await prisma.labResult.findUniqueOrThrow({ where: { id }, include: laboratoryResultInclude })
    return Response.json({ success: true, data: await serializeLabResult(result) } satisfies ApiResponse<LabResultDetail>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Result was not found.", 404],
      IMMUTABLE: ["Validated and released results cannot be edited.", 409],
      SAMPLE_REQUIRED: ["Select a received or processing sample from this request.", 409],
      PARAMETER_INVALID: ["A result parameter does not belong to this test.", 400],
      STALE: ["The result changed while it was being updated. Refresh and try again.", 409],
    }
    const [message, status] = map[code] ?? ["Result could not be updated.", 500]
    return Response.json({ success: false, message, code }, { status })
  }
}
