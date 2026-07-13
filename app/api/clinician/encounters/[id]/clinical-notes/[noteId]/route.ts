import type { NextRequest } from "next/server"

import { ensureMutableEncounter, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { clinicalNoteInclude, serializeNote } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { noteSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; noteId: string }> }) {
  return withClinician(request, async (actor) => {
    const { id, noteId } = await context.params
    const parsed = noteSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const row = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const before = await tx.clinicalNote.findFirst({ where: { id: noteId, encounterId: id, authoredById: actor.id } })
      if (!before) throw new Error("NOTE_NOT_FOUND")
      if (before.signedAt) throw new Error("SIGNED_NOTE_LOCKED")
      const { sign, ...values } = parsed.data
      const updated = await tx.clinicalNote.update({ where: { id: noteId }, data: { ...values, signedAt: sign ? new Date() : null }, include: clinicalNoteInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: sign ? AuditAction.APPROVE : AuditAction.UPDATE, entityType: "ClinicalNote", entityId: noteId, description: sign ? "Signed clinical note" : "Updated clinical note draft", before: { signedAt: null }, after: { signedAt: updated.signedAt?.toISOString() ?? null } })
      return updated
    })
    return ok(serializeNote(row))
  })
}

