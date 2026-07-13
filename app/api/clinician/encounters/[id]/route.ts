import type { NextRequest } from "next/server"

import { apiError, canTransitionEncounter, ensureDepartmentInFacility, ensureMutableEncounter, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { clinicianEncounterInclude, getEncounterDetail, serializeEncounter } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { encounterUpdateSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const detail = await getEncounterDetail(id, actor.facilityId, actor.id)
    return detail ? ok(detail) : apiError("Encounter was not found.", 404)
  })
}

export async function PATCH(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = encounterUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const row = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      if (parsed.data.departmentId && !(await ensureDepartmentInFacility(parsed.data.departmentId, actor.facilityId, tx))) throw new Error("DEPARTMENT_NOT_FOUND")
      if (parsed.data.status && !canTransitionEncounter(checked.encounter.status, parsed.data.status)) throw new Error("INVALID_ENCOUNTER_TRANSITION")
      const updated = await tx.encounter.update({ where: { id }, data: parsed.data, include: clinicianEncounterInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "Encounter", entityId: id, description: `Updated encounter ${updated.encounterNo}`, before: { status: checked.encounter.status, chiefComplaint: checked.encounter.chiefComplaint }, after: { status: updated.status, chiefComplaint: updated.chiefComplaint } })
      return updated
    })
    return ok(serializeEncounter(row, actor.id))
  })
}

