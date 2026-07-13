import type { NextRequest } from "next/server"

import { apiError, ensureMutableEncounter, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { diagnosisInclude, getEncounterDetail, serializeDiagnosis } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { diagnosisSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const detail = await getEncounterDetail(id, actor.facilityId, actor.id)
    return detail ? ok(detail.diagnoses) : apiError("Encounter was not found.", 404)
  })
}

export async function POST(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = diagnosisSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const diagnosis = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      if (parsed.data.isPrimary) await tx.diagnosis.updateMany({ where: { encounterId: id, isPrimary: true }, data: { isPrimary: false } })
      const created = await tx.diagnosis.create({ data: { ...parsed.data, patientId: checked.encounter.patientId, encounterId: id, diagnosedById: actor.id }, include: diagnosisInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "Diagnosis", entityId: created.id, description: `Added diagnosis ${created.name}`, after: { encounterId: id, code: created.code, isPrimary: created.isPrimary } })
      return created
    })
    return ok(serializeDiagnosis(diagnosis))
  })
}

