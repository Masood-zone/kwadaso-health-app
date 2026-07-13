import type { NextRequest } from "next/server"

import { ensureMutableEncounter, generateLabRequestNo, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { labRequestInclude, serializeLabRequest } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { labRequestSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = labRequestSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const record = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const testIds = [...new Set(parsed.data.tests.map((item) => item.testId))]
      const tests = await tx.labTestCatalog.count({ where: { id: { in: testIds }, facilityId: actor.facilityId, isActive: true } })
      if (tests !== testIds.length) throw new Error("LAB_TEST_NOT_FOUND")
      const created = await tx.labRequest.create({ data: { requestNo: generateLabRequestNo(), patientId: checked.encounter.patientId, encounterId: id, requestedById: actor.id, priority: parsed.data.priority, clinicalNotes: parsed.data.clinicalNotes, status: "REQUESTED", tests: { create: parsed.data.tests.map((item) => ({ testId: item.testId, notes: item.notes })) } }, include: labRequestInclude })
      await tx.encounter.update({ where: { id }, data: { status: "AWAITING_LAB" } })
      if (checked.encounter.queueId) await tx.patientQueue.update({ where: { id: checked.encounter.queueId }, data: { status: "AWAITING_LAB" } })
      await tx.notification.create({ data: { facilityId: actor.facilityId, createdById: actor.id, targetRole: "LAB_TECHNICIAN", type: "LAB_RESULT", priority: parsed.data.priority === "STAT" ? "URGENT" : "NORMAL", title: `New lab request ${created.requestNo}`, body: created.clinicalNotes, actionUrl: `/laboratory/requests/${created.id}`, entityType: "LabRequest", entityId: created.id } })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "LabRequest", entityId: created.id, description: `Created lab request ${created.requestNo}`, after: { encounterId: id, priority: created.priority, testCount: created.tests.length } })
      return created
    })
    return ok(serializeLabRequest(record))
  })
}

