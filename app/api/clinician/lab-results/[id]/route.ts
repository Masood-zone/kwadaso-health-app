import type { NextRequest } from "next/server"
import { apiError, writeClinicianAuditLog } from "@/lib/clinician"
import { labResultInclude, serializeLabResult } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const row = await prisma.labResult.findFirst({ where: { id, encounter: { facilityId: actor.facilityId }, status: "RELEASED" }, include: labResultInclude })
    if (!row) return apiError("Released lab result was not found.", 404)
    await writeClinicianAuditLog({ request, actor, action: AuditAction.READ, entityType: "LabResult", entityId: id, description: `Clinician reviewed result ${row.resultNo}` })
    return ok(serializeLabResult(row))
  })
}

