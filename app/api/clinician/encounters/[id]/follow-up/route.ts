import type { NextRequest } from "next/server"

import { ensureDepartmentInFacility, ensureMutableEncounter, generateAppointmentNo, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { followUpInclude, serializeFollowUp } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { followUpSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const parsed = followUpSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const record = await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(id, actor, tx)
      if (checked.error || !checked.encounter) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      if (!(await ensureDepartmentInFacility(parsed.data.departmentId, actor.facilityId, tx))) throw new Error("DEPARTMENT_NOT_FOUND")
      if (parsed.data.clinicianId && !(await tx.user.findFirst({ where: { id: parsed.data.clinicianId, facilityId: actor.facilityId, status: "ACTIVE", defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] } } }))) throw new Error("CLINICIAN_NOT_FOUND")
      const created = await tx.appointment.create({ data: { appointmentNo: generateAppointmentNo(), patientId: checked.encounter.patientId, facilityId: actor.facilityId, departmentId: parsed.data.departmentId, clinicianId: parsed.data.clinicianId ?? actor.id, title: parsed.data.title ?? "Clinical follow-up", reason: parsed.data.reason, scheduledAt: new Date(parsed.data.scheduledAt), durationMinutes: parsed.data.durationMinutes, status: "SCHEDULED", createdById: actor.id }, include: followUpInclude })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "Appointment", entityId: created.id, description: `Scheduled follow-up ${created.appointmentNo}`, after: { encounterId: id, scheduledAt: created.scheduledAt.toISOString() } })
      return created
    })
    return ok(serializeFollowUp(record))
  })
}

