import type { NextRequest } from "next/server"
import { z } from "zod"
import { apiError, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { referralInclude, serializeReferral } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const row = await prisma.referral.findFirst({ where: { id, fromFacilityId: actor.facilityId }, include: referralInclude })
    return row ? ok(serializeReferral(row)) : apiError("Referral was not found.", 404)
  })
}

export async function PATCH(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = z.object({ status: z.enum(["DRAFT", "SENT", "CANCELLED"]), reason: z.string().trim().min(1).optional(), clinicalSummary: z.string().trim().nullable().optional(), urgency: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]).optional() }).safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.referral.findFirst({ where: { id, fromFacilityId: actor.facilityId, referredById: actor.id } })
      if (!before) throw new Error("REFERRAL_NOT_FOUND")
      if (["RECEIVED", "ACCEPTED", "COMPLETED"].includes(before.status)) throw new Error("REFERRAL_LOCKED")
      const updated = await tx.referral.update({ where: { id }, data: { ...parsed.data, sentAt: parsed.data.status === "SENT" ? (before.sentAt ?? new Date()) : before.sentAt }, include: referralInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: parsed.data.status === "CANCELLED" ? AuditAction.REJECT : AuditAction.UPDATE, entityType: "Referral", entityId: id, description: `Updated referral ${updated.referralNo}`, before: { status: before.status }, after: { status: updated.status } })
      return updated
    })
    return ok(serializeReferral(row))
  })
}

