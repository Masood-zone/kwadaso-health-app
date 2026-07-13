import type { NextRequest } from "next/server"

import { ensureDepartmentInFacility, ensurePatientInFacility, generateEncounterNo, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { clinicianEncounterInclude, serializeEncounter } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { encounterCreateSchema } from "@/lib/clinician-schemas"
import { AuditAction, EncounterStatus } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const status = request.nextUrl.searchParams.get("status")
    const encounters = await prisma.encounter.findMany({ where: { facilityId: actor.facilityId, ...(status ? { status: status as EncounterStatus } : {}) }, include: clinicianEncounterInclude, orderBy: { startedAt: "desc" }, take: 200 })
    return ok(encounters.map((item) => serializeEncounter(item, actor.id)))
  })
}

export async function POST(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const parsed = encounterCreateSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const values = parsed.data
    const encounter = await prisma.$transaction(async (tx) => {
      if (!(await ensurePatientInFacility(values.patientId, actor.facilityId, tx))) throw new Error("PATIENT_NOT_FOUND")
      if (!(await ensureDepartmentInFacility(values.departmentId, actor.facilityId, tx))) throw new Error("DEPARTMENT_NOT_FOUND")
      if (values.appointmentId && !(await tx.appointment.findFirst({ where: { id: values.appointmentId, patientId: values.patientId, facilityId: actor.facilityId } }))) throw new Error("APPOINTMENT_NOT_FOUND")
      if (values.queueId) {
        const queue = await tx.patientQueue.findFirst({ where: { id: values.queueId, patientId: values.patientId, department: { facilityId: actor.facilityId } } })
        if (!queue) throw new Error("QUEUE_NOT_FOUND")
        if (!["IN_TRIAGE", "WITH_CLINICIAN", "AWAITING_LAB"].includes(queue.status)) throw new Error("QUEUE_NOT_READY")
        const claimed = await tx.patientQueue.updateMany({ where: { id: queue.id, OR: [{ assignedToId: null }, { assignedToId: actor.id }] }, data: { assignedToId: actor.id, status: "WITH_CLINICIAN", calledAt: queue.calledAt ?? new Date() } })
        if (claimed.count !== 1) throw new Error("QUEUE_CLAIMED")
      }
      const created = await tx.encounter.create({ data: { encounterNo: generateEncounterNo(), patientId: values.patientId, appointmentId: values.appointmentId ?? null, queueId: values.queueId ?? null, facilityId: actor.facilityId, departmentId: values.departmentId, clinicianId: actor.id, visitType: values.visitType, chiefComplaint: values.chiefComplaint, status: "IN_PROGRESS", startedAt: new Date() }, include: clinicianEncounterInclude })
      if (values.appointmentId) await tx.appointment.update({ where: { id: values.appointmentId }, data: { status: "IN_PROGRESS", clinicianId: actor.id } })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "Encounter", entityId: created.id, description: `Started encounter ${created.encounterNo}`, after: { patientId: created.patientId, queueId: created.queueId, status: created.status } })
      return created
    })
    return ok(serializeEncounter(encounter, actor.id), "Consultation started.")
  })
}

