import type { NextRequest } from "next/server"

import { ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const [departments, clinicians, staff, labTests, medications, facilities] = await Promise.all([
      prisma.department.findMany({ where: { facilityId: actor.facilityId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { facilityId: actor.facilityId, status: "ACTIVE", defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] } }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { facilityId: actor.facilityId, status: "ACTIVE" }, orderBy: { name: "asc" } }),
      prisma.labTestCatalog.findMany({ where: { facilityId: actor.facilityId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.medication.findMany({ where: { facilityId: actor.facilityId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.facility.findMany({ orderBy: { name: "asc" } }),
    ])
    return ok({
      departments: departments.map(({ id, name, type }) => ({ id, name, type })),
      clinicians: clinicians.map(({ id, name, defaultRole: role, departmentId }) => ({ id, name, role, departmentId })),
      staff: staff.map(({ id, name, defaultRole: role, departmentId }) => ({ id, name, role, departmentId })),
      labTests: labTests.map(({ id, code, name, category, sampleType }) => ({ id, code, name, category, sampleType })),
      medications: medications.map(({ id, code, name, genericName, strength, dosageForm }) => ({ id, code, name, genericName, strength, dosageForm })),
      facilities: facilities.map(({ id, name }) => ({ id, name })),
    })
  })
}
