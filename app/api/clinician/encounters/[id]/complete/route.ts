import type { NextRequest } from "next/server"

import { apiError, ensureMutableEncounter, writeClinicianAuditLog } from "@/lib/clinician"
import { clinicianEncounterInclude, serializeEncounter } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { encounterCompleteSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    if (!encounterCompleteSchema.safeParse(await request.json()).success) return apiError("Legal record acknowledgement is required.")
    const completed = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const [signedNote, primaryDiagnosis] = await Promise.all([tx.clinicalNote.findFirst({ where: { encounterId: id, signedAt: { not: null } } }), tx.diagnosis.findFirst({ where: { encounterId: id, isPrimary: true } })])
      if (!signedNote) throw new Error("SIGNED_NOTE_REQUIRED")
      if (!primaryDiagnosis) throw new Error("PRIMARY_DIAGNOSIS_REQUIRED")
      const record = await tx.encounter.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() }, include: clinicianEncounterInclude })
      if (record.queueId) await tx.patientQueue.update({ where: { id: record.queueId }, data: { status: "COMPLETED", completedAt: new Date() } })
      if (record.appointmentId) await tx.appointment.update({ where: { id: record.appointmentId }, data: { status: "COMPLETED" } })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.APPROVE, entityType: "Encounter", entityId: id, description: `Completed and locked encounter ${record.encounterNo}`, before: { status: checked.encounter.status }, after: { status: record.status, completedAt: record.completedAt?.toISOString() } })
      return record
    })
    return ok(serializeEncounter(completed, actor.id), "Encounter completed and locked.")
  })
}

