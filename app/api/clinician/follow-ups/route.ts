import type { NextRequest } from "next/server"
import { followUpInclude, serializeFollowUp } from "@/lib/clinician-data"
import { startOfDay, ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => ok((await prisma.appointment.findMany({ where: { facilityId: actor.facilityId, scheduledAt: { gte: startOfDay() }, createdBy: { defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] } } }, include: followUpInclude, orderBy: { scheduledAt: "asc" } })).map(serializeFollowUp)))
}

