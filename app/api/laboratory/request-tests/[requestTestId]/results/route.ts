import { NextRequest } from "next/server"
import { z } from "zod"

import {
  calculateParameterFlags,
  generateResultNo,
  laboratoryRequestScope,
  laboratoryResultInclude,
  requireLaboratoryApi,
  serializeLabResult,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import { laboratoryResultPayloadSchema } from "@/lib/laboratory-schemas"
import type { ApiResponse } from "@/types"
import type { LabResultDetail } from "@/types/laboratory"

export async function POST(request: NextRequest, context: { params: Promise<{ requestTestId: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { requestTestId } = await context.params
  const parsed = laboratoryResultPayloadSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ success: false, message: "Result details are invalid.", errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 })
  }
  try {
    let resultId: string | null = null
    for (let attempt = 0; attempt < 3 && !resultId; attempt += 1) {
      try {
        resultId = await prisma.$transaction(async (tx) => {
          const requestTest = await tx.labRequestTest.findFirst({
            where: { id: requestTestId, labRequest: laboratoryRequestScope(actor!.facilityId) },
            include: {
              result: true,
              test: { include: { parameterDefinitions: true } },
              labRequest: { include: { samples: true } },
            },
          })
          if (!requestTest) throw new Error("NOT_FOUND")
          if (requestTest.result) throw new Error("DUPLICATE")
          if (["CANCELLED", "COMPLETED"].includes(requestTest.labRequest.status)) throw new Error("REQUEST_CLOSED")
          const sample = requestTest.labRequest.samples.find(
            (item) => item.id === parsed.data.labSampleId && ["RECEIVED", "PROCESSING", "STORED"].includes(item.status)
          )
          if (!sample) throw new Error("SAMPLE_REQUIRED")
          const definitions = new Map(requestTest.test.parameterDefinitions.map((item) => [item.id, item]))
          const parameters = parsed.data.parameters.map((parameter) => {
            const definition = parameter.parameterDefinitionId ? definitions.get(parameter.parameterDefinitionId) : undefined
            if (parameter.parameterDefinitionId && !definition) throw new Error("PARAMETER_INVALID")
            const flags = calculateParameterFlags(parameter.value, definition, parameter)
            return {
              parameterDefinitionId: definition?.id ?? null,
              parameterName: definition?.name ?? parameter.parameterName,
              value: parameter.value,
              unit: parameter.unit ?? definition?.unit,
              referenceRange: parameter.referenceRange ?? definition?.referenceRange,
              ...flags,
            }
          })
          const abnormalFlag = Boolean(parsed.data.abnormalFlag || parameters.some((item) => item.isAbnormal))
          const criticalFlag = Boolean(parsed.data.criticalFlag || parameters.some((item) => item.isCritical))
          const created = await tx.labResult.create({
            data: {
              resultNo: generateResultNo(),
              labRequestTestId: requestTestId,
              patientId: requestTest.labRequest.patientId,
              encounterId: requestTest.labRequest.encounterId,
              testId: requestTest.testId,
              labSampleId: sample.id,
              status: parsed.data.status,
              resultText: parsed.data.resultText,
              notes: parsed.data.notes,
              abnormalFlag,
              criticalFlag,
              enteredById: actor!.id,
              enteredAt: parsed.data.status === "ENTERED" ? new Date() : null,
              items: { create: parameters },
            },
          })
          if (parsed.data.status === "ENTERED" && requestTest.labRequest.status !== "PARTIAL_RESULT") {
            await tx.labRequest.update({ where: { id: requestTest.labRequestId }, data: { status: "PARTIAL_RESULT" } })
            await writeLaboratoryAuditLog({
              client: tx,
              request,
              actor: actor!,
              action: "UPDATE",
              entityType: "LabRequest",
              entityId: requestTest.labRequestId,
              description: `Marked request ${requestTest.labRequest.requestNo} as partially resulted`,
              before: { status: requestTest.labRequest.status },
              after: { status: "PARTIAL_RESULT" },
            })
          }
          await writeLaboratoryAuditLog({
            client: tx,
            request,
            actor: actor!,
            action: "CREATE",
            entityType: "LabResult",
            entityId: created.id,
            description: `Created result ${created.resultNo} for ${requestTest.test.name}`,
            after: { status: created.status, sampleId: sample.id, abnormalFlag, criticalFlag, parameterCount: parameters.length },
          })
          return created.id
        })
      } catch (error) {
        const prismaCode = typeof error === "object" && error && "code" in error ? String(error.code) : null
        if (prismaCode === "P2002" && attempt < 2) continue
        throw error
      }
    }
    if (!resultId) throw new Error("NUMBER_GENERATION_FAILED")
    const result = await prisma.labResult.findUniqueOrThrow({ where: { id: resultId }, include: laboratoryResultInclude })
    return Response.json({ success: true, data: await serializeLabResult(result) } satisfies ApiResponse<LabResultDetail>, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Requested test was not found.", 404],
      DUPLICATE: ["A result already exists for this requested test.", 409],
      REQUEST_CLOSED: ["Results cannot be added to a closed request.", 409],
      SAMPLE_REQUIRED: ["Select a received or processing sample from this request.", 409],
      PARAMETER_INVALID: ["A result parameter does not belong to this test.", 400],
      NUMBER_GENERATION_FAILED: ["A unique result number could not be generated.", 500],
    }
    const [message, status] = map[code] ?? ["Result could not be created.", 500]
    return Response.json({ success: false, message, code }, { status })
  }
}
