import type { NextRequest } from "next/server"
import { prescriptionInclude, serializePrescription } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => ok((await prisma.prescription.findMany({ where: { encounter: { facilityId: actor.facilityId } }, include: prescriptionInclude, orderBy: { createdAt: "desc" }, take: 200 })).map(serializePrescription)))
}
