import type { NextRequest } from "next/server"
import { referralInclude, serializeReferral } from "@/lib/clinician-data"
import { ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => ok((await prisma.referral.findMany({ where: { fromFacilityId: actor.facilityId }, include: referralInclude, orderBy: { createdAt: "desc" }, take: 200 })).map(serializeReferral)))
}
