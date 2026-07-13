import type { NextRequest } from "next/server"

import { ensureMutableEncounter, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { clinicalNoteInclude, getEncounterDetail, serializeNote } from "@/lib/clinician-data"
import { apiError } from "@/lib/clinician"
import { ok, withClinician } from "@/lib/clinician-route"
import { noteSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const detail = await getEncounterDetail(id, actor.facilityId, actor.id)
    return detail ? ok(detail.clinicalNotes) : apiError("Encounter was not found.", 404)
  })
}

export async function POST(request: NextRequest, context: Context) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = noteSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const note = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const { sign, ...values } = parsed.data
      const created = await tx.clinicalNote.create({ data: { patientId: checked.encounter.patientId, encounterId: id, authoredById: actor.id, ...values, signedAt: sign ? new Date() : null }, include: clinicalNoteInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: sign ? AuditAction.APPROVE : AuditAction.CREATE, entityType: "ClinicalNote", entityId: created.id, description: sign ? "Created and signed clinical note" : "Created clinical note draft", after: { encounterId: id, signedAt: created.signedAt?.toISOString() ?? null } })
      return created
    })
    return ok(serializeNote(note))
  })
}

