import type { NextRequest } from "next/server"
import { z } from "zod"
import { apiError, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { labRequestInclude, serializeLabRequest } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { reconcileEncounterAfterLaboratory } from "@/lib/laboratory"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const row = await prisma.labRequest.findFirst({ where: { id, encounter: { facilityId: actor.facilityId } }, include: labRequestInclude })
    return row ? ok(serializeLabRequest(row)) : apiError("Lab request was not found.", 404)
  })
}

export async function PATCH(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = z.object({ clinicalNotes: z.string().trim().nullable().optional(), cancel: z.boolean().optional(), cancellationReason: z.string().trim().nullable().optional() }).safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.labRequest.findFirst({ where: { id, requestedById: actor.id, encounter: { facilityId: actor.facilityId } }, include: { samples: true } })
      if (!before) throw new Error("LAB_REQUEST_NOT_FOUND")
      if (before.status !== "REQUESTED" || before.samples.some((sample) => sample.status !== "PENDING_COLLECTION")) throw new Error("LAB_REQUEST_LOCKED")
      if (parsed.data.cancel && !parsed.data.cancellationReason) throw new Error("CANCELLATION_REASON_REQUIRED")
      const updated = await tx.labRequest.update({ where: { id }, data: { clinicalNotes: parsed.data.clinicalNotes, ...(parsed.data.cancel ? { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: parsed.data.cancellationReason } : {}) }, include: labRequestInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: parsed.data.cancel ? AuditAction.REJECT : AuditAction.UPDATE, entityType: "LabRequest", entityId: id, description: `${parsed.data.cancel ? "Cancelled" : "Updated"} lab request ${updated.requestNo}`, before: { status: before.status }, after: { status: updated.status } })
      if (parsed.data.cancel) await reconcileEncounterAfterLaboratory(tx, updated.encounterId, { request, actor })
      return updated
    })
    return ok(serializeLabRequest(row))
  })
}

