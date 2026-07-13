import { NextRequest } from "next/server"
import { z } from "zod"

import {
  ensureLaboratoryResult,
  laboratoryResultInclude,
  requireLaboratoryApi,
  serializeLabResult,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabResultDetail } from "@/types/laboratory"

const schema = z.object({ confirmed: z.literal(true), reason: z.string().trim().min(3) })

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ success: false, message: "Confirm the critical result and provide a reason." }, { status: 400 })
  try {
    await prisma.$transaction(async (tx) => {
      const result = await ensureLaboratoryResult(id, actor!.facilityId, tx)
      if (!result) throw new Error("NOT_FOUND")
      if (!result.requestTest.labRequest.requestedById) throw new Error("CLINICIAN_REQUIRED")
      const existing = await tx.notification.findFirst({
        where: { recipientId: result.requestTest.labRequest.requestedById, type: "CRITICAL_ALERT", entityType: "LabResult", entityId: id },
      })
      if (existing) return
      await tx.labResult.update({ where: { id }, data: { criticalFlag: true } })
      await tx.notification.createMany({
        data: [
          {
            recipientId: result.requestTest.labRequest.requestedById,
            facilityId: actor!.facilityId,
            createdById: actor!.id,
            type: "CRITICAL_ALERT",
            priority: "URGENT",
            title: `Critical ${result.test.name} result`,
            body: `${result.patient.firstName} ${result.patient.lastName}: ${parsed.data.reason}`,
            actionUrl: "/clinician/lab-requests",
            entityType: "LabResult",
            entityId: id,
          },
          {
            facilityId: actor!.facilityId,
            createdById: actor!.id,
            targetRole: "HOSPITAL_ADMIN",
            type: "CRITICAL_ALERT",
            priority: "URGENT",
            title: `Critical ${result.test.name} result escalation`,
            body: `${result.patient.firstName} ${result.patient.lastName}: ${parsed.data.reason}`,
            actionUrl: `/hospital-admin/notifications`,
            entityType: "LabResult",
            entityId: id,
          },
        ],
      })
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "SEND",
        entityType: "LabResult",
        entityId: id,
        description: `Sent critical alert for result ${result.resultNo}`,
        before: { criticalFlag: result.criticalFlag, alertSent: false },
        after: { criticalFlag: true, alertSent: true, reason: parsed.data.reason, recipients: ["ORDERING_CLINICIAN", "HOSPITAL_ADMIN"] },
      })
    })
    const result = await prisma.labResult.findUniqueOrThrow({ where: { id }, include: laboratoryResultInclude })
    return Response.json({ success: true, data: await serializeLabResult(result) } satisfies ApiResponse<LabResultDetail>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["Result was not found.", 404],
      CLINICIAN_REQUIRED: ["The ordering clinician could not be identified.", 409],
    }
    const [message, status] = map[code] ?? ["Critical alert could not be sent.", 500]
    return Response.json({ success: false, message, code }, { status })
  }
}
