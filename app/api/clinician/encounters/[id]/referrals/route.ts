import type { NextRequest } from "next/server"

import { apiError, ensureDepartmentInFacility, ensureMutableEncounter, generateReferralNo, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { referralInclude, serializeReferral } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { referralSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = referralSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    if (!parsed.data.toDepartmentId && !parsed.data.toFacilityId) return apiError("Choose an internal department or schema-backed facility.")
    const record = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      if (parsed.data.toDepartmentId && !(await ensureDepartmentInFacility(parsed.data.toDepartmentId, actor.facilityId, tx))) throw new Error("DEPARTMENT_NOT_FOUND")
      if (parsed.data.toFacilityId && !(await tx.facility.findUnique({ where: { id: parsed.data.toFacilityId } }))) throw new Error("FACILITY_NOT_FOUND")
      const created = await tx.referral.create({ data: { referralNo: generateReferralNo(), patientId: checked.encounter.patientId, encounterId: id, fromFacilityId: actor.facilityId, toFacilityId: parsed.data.toFacilityId, fromDepartmentId: checked.encounter.departmentId, toDepartmentId: parsed.data.toDepartmentId, referredById: actor.id, reason: parsed.data.reason, clinicalSummary: parsed.data.clinicalSummary, urgency: parsed.data.urgency, status: "SENT", sentAt: new Date() }, include: referralInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.SEND, entityType: "Referral", entityId: created.id, description: `Sent referral ${created.referralNo}`, after: { encounterId: id, toDepartmentId: created.toDepartmentId, toFacilityId: created.toFacilityId } })
      return created
    })
    return ok(serializeReferral(record))
  })
}

