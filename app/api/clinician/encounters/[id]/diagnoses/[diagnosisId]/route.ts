import type { NextRequest } from "next/server"

import { ensureMutableEncounter, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { diagnosisInclude, serializeDiagnosis } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { diagnosisSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string; diagnosisId: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id, diagnosisId } = await context.params
    const parsed = diagnosisSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const row = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const before = await tx.diagnosis.findFirst({ where: { id: diagnosisId, encounterId: id } })
      if (!before) throw new Error("DIAGNOSIS_NOT_FOUND")
      if (parsed.data.isPrimary) await tx.diagnosis.updateMany({ where: { encounterId: id, isPrimary: true, id: { not: diagnosisId } }, data: { isPrimary: false } })
      const updated = await tx.diagnosis.update({ where: { id: diagnosisId }, data: parsed.data, include: diagnosisInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.UPDATE, entityType: "Diagnosis", entityId: diagnosisId, description: `Updated diagnosis ${updated.name}`, before: { name: before.name, isPrimary: before.isPrimary }, after: { name: updated.name, isPrimary: updated.isPrimary } })
      return updated
    })
    return ok(serializeDiagnosis(row))
  })
}

export async function DELETE(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id, diagnosisId } = await context.params
    await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const diagnosis = await tx.diagnosis.findFirst({ where: { id: diagnosisId, encounterId: id } })
      if (!diagnosis) throw new Error("DIAGNOSIS_NOT_FOUND")
      await tx.diagnosis.delete({ where: { id: diagnosisId } })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.DELETE, entityType: "Diagnosis", entityId: diagnosisId, description: `Removed diagnosis ${diagnosis.name}`, before: { code: diagnosis.code, name: diagnosis.name, isPrimary: diagnosis.isPrimary } })
    })
    return ok({ id: diagnosisId }, "Diagnosis removed.")
  })
}

