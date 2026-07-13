import type { NextRequest } from "next/server"

import { clinicianQueueInclude, serializeQueue } from "@/lib/clinician-data"
import { endOfDay, ok, priorityRank, startOfDay, withClinician } from "@/lib/clinician-route"
import { QueueStatus } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const params = request.nextUrl.searchParams
    const status = params.get("status")
    const priority = params.get("priority")
    const departmentId = params.get("departmentId")
    const search = params.get("search")?.trim()
    const queueNo = params.get("queueNo")?.trim()
    const date = params.get("date")
    const entries = await prisma.patientQueue.findMany({
      where: {
        department: { facilityId: actor.facilityId },
        status: status ? (status as QueueStatus) : { in: ["WITH_CLINICIAN", "AWAITING_LAB"] },
        OR: [{ assignedToId: actor.id }, { assignedToId: null }],
        ...(priority ? { priority: priority as never } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(queueNo ? { queueNo: { contains: queueNo, mode: "insensitive" } } : {}),
        ...(date ? { arrivedAt: { gte: startOfDay(new Date(date)), lte: endOfDay(new Date(date)) } } : {}),
        ...(search ? { patient: { OR: [
          { patientNo: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ] } } : {}),
      },
      include: clinicianQueueInclude,
      orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }],
    })
    return ok(entries.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]).map((item) => serializeQueue(item, actor.id)))
  })
}

