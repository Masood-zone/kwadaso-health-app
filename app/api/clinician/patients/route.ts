import type { NextRequest } from "next/server"

import { getAge } from "@/lib/clinician"
import { ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const search = request.nextUrl.searchParams.get("search")?.trim()
    const patients = await prisma.patient.findMany({
      where: { registeredFacilityId: actor.facilityId, status: "ACTIVE", ...(search ? { OR: [
        { patientNo: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ] } : {}) },
      include: {
        encounters: { orderBy: { startedAt: "desc" }, take: 1 },
        queueEntries: { where: { status: { in: ["IN_TRIAGE", "WITH_CLINICIAN", "AWAITING_LAB", "AWAITING_PHARMACY"] } }, orderBy: { arrivedAt: "desc" }, take: 1 },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 100,
    })
    return ok(patients.map((patient) => ({
      id: patient.id,
      patientNo: patient.patientNo,
      name: [patient.firstName, patient.otherNames, patient.lastName].filter(Boolean).join(" "),
      gender: patient.gender,
      age: getAge(patient.dateOfBirth, patient.estimatedAge),
      phone: patient.phone,
      community: patient.community,
      latestEncounterStatus: patient.encounters[0]?.status ?? null,
      activeQueueStatus: patient.queueEntries[0]?.status ?? null,
    })))
  })
}

