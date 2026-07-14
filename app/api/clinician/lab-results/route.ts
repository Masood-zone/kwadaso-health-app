import type { NextRequest } from "next/server"
import { labResultInclude, serializeLabResult } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => ok((await prisma.labResult.findMany({ where: { encounter: { facilityId: actor.facilityId }, status: "RELEASED" }, include: labResultInclude, orderBy: { createdAt: "desc" }, take: 200 })).map(serializeLabResult)))
}
