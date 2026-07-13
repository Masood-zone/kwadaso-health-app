import { NextRequest } from "next/server"
import { z } from "zod"

import {
  ensureLaboratoryResult,
  getMissingRequiredParameters,
  laboratoryResultInclude,
  requireLaboratoryApi,
  serializeLabResult,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabResultDetail } from "@/types/laboratory"

const schema = z.object({
  decision: z.enum(["VALIDATE", "REJECT"]),
  note: z.string().trim().nullable().optional(),
  criticalConfirmed: z.boolean().optional(),
})

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ success: false, message: "Validation decision is invalid." }, { status: 400 })
  try {
    await prisma.$transaction(async (tx) => {
      const before = await ensureLaboratoryResult(id, actor!.facilityId, tx)
      if (!before) throw new Error("NOT_FOUND")
      if (before.status !== "ENTERED") throw new Error("INVALID_STATUS")
      if (parsed.data.decision === "REJECT") {
        if (!parsed.data.note) throw new Error("NOTE_REQUIRED")
        const changed = await tx.labResult.updateMany({
          where: { id, status: "ENTERED" },
          data: { status: "REJECTED", validationNote: parsed.data.note, validatedAt: null, validatedById: null },
        })
        if (!changed.count) throw new Error("STALE")
        await tx.notification.create({
          data: {
            recipientId: before.enteredById,
            facilityId: actor!.facilityId,
            createdById: actor!.id,
            type: "LAB_RESULT",
            priority: "HIGH",
            title: `Result ${before.resultNo} needs correction`,
            body: parsed.data.note,
            actionUrl: `/laboratory/results/entry?resultId=${id}`,
            entityType: "LabResult",
            entityId: id,
          },
        })
        await writeLaboratoryAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: "REJECT",
          entityType: "LabResult",
          entityId: id,
          description: `Rejected result ${before.resultNo} for correction`,
          before: { status: before.status },
          after: { status: "REJECTED", note: parsed.data.note },
        })
        return
      }
      const parameters = before.items.map((item) => ({
        parameterDefinitionId: item.parameterDefinitionId,
        parameterName: item.parameterName,
        value: item.value,
      }))
      const missing = getMissingRequiredParameters(before.test.parameterDefinitions, parameters)
      if (missing.length) throw new Error(`MISSING:${missing.join(", ")}`)
      if (!before.resultText?.trim() && !parameters.some((item) => item.value?.trim())) throw new Error("RESULT_REQUIRED")
      if (before.criticalFlag && !parsed.data.criticalConfirmed) throw new Error("CRITICAL_CONFIRMATION_REQUIRED")
      const changed = await tx.labResult.updateMany({
        where: { id, status: "ENTERED" },
        data: { status: "VALIDATED", validatedById: actor!.id, validatedAt: new Date(), validationNote: parsed.data.note },
      })
      if (!changed.count) throw new Error("STALE")
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "VALIDATE",
        entityType: "LabResult",
        entityId: id,
        description: `Validated result ${before.resultNo}`,
        before: { status: before.status },
        after: { status: "VALIDATED", criticalConfirmed: Boolean(parsed.data.criticalConfirmed), note: parsed.data.note ?? null },
      })
    })
    const result = await prisma.labResult.findUniqueOrThrow({ where: { id }, include: laboratoryResultInclude })
    return Response.json({ success: true, data: await serializeLabResult(result) } satisfies ApiResponse<LabResultDetail>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    if (code.startsWith("MISSING:")) return Response.json({ success: false, message: `Complete required parameters: ${code.slice(8)}.`, code: "MISSING_PARAMETERS" }, { status: 400 })
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Result was not found.", 404],
      INVALID_STATUS: ["Only entered results can be validated or rejected.", 409],
      NOTE_REQUIRED: ["A correction note is required when rejecting a result.", 400],
      RESULT_REQUIRED: ["Enter result text or at least one parameter value.", 400],
      CRITICAL_CONFIRMATION_REQUIRED: ["Confirm the critical values before validation.", 400],
      STALE: ["The result changed while it was being reviewed. Refresh and try again.", 409],
    }
    const [message, status] = map[code] ?? ["Result could not be reviewed.", 500]
    return Response.json({ success: false, message, code }, { status })
  }
}
