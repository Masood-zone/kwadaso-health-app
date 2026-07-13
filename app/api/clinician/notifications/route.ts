import type { NextRequest } from "next/server"
import { serializeNotification } from "@/lib/clinician-data"
import { notificationWhere, ok, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => ok((await prisma.notification.findMany({ where: notificationWhere(actor), orderBy: { createdAt: "desc" }, take: 100 })).map(serializeNotification)))
}

