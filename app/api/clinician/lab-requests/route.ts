import type { NextRequest } from "next/server"
import { labRequestInclude, serializeLabRequest } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => ok((await prisma.labRequest.findMany({ where: { encounter: { facilityId: actor.facilityId } }, include: labRequestInclude, orderBy: { requestedAt: "desc" }, take: 200 })).map(serializeLabRequest)))
}
