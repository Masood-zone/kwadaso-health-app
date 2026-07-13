import type { NextRequest } from "next/server"

import { apiError, writeClinicianAuditLog } from "@/lib/clinician"
import { getPatientClinicalProfile } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { AuditAction } from "@/lib/generated/prisma/enums"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withClinician(request, async (actor) => {
    const { id } = await context.params
    const profile = await getPatientClinicalProfile(id, actor.facilityId, actor.id)
    if (!profile) return apiError("Patient was not found.", 404)
    await writeClinicianAuditLog({ request, actor, action: AuditAction.READ, entityType: "PatientClinicalProfile", entityId: id, description: `Clinician viewed clinical profile ${profile.patientNo}` })
    return ok(profile)
  })
}

