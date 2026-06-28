import { NextRequest } from "next/server"

import { requireNurseApi, serializeQueueEntry } from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

function dayRange(value?: string | null) {
  const base = value ? new Date(value) : new Date()
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const end = new Date(base)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const { start, end } = dayRange(searchParams.get("date"))
  const departmentId = searchParams.get("departmentId")
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const search = searchParams.get("search")?.trim()
  const queueNo = searchParams.get("queueNo")?.trim()

  const queue = await prisma.patientQueue.findMany({
    where: {
      department: { facilityId: actor!.facilityId },
      status: status
        ? (status as never)
        : { in: ["WAITING", "IN_TRIAGE", "WITH_CLINICIAN", "CANCELLED"] },
      arrivedAt: { gte: start, lte: end },
      ...(departmentId ? { departmentId } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(queueNo ? { queueNo: { contains: queueNo, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { patient: { firstName: { contains: search, mode: "insensitive" } } },
              { patient: { lastName: { contains: search, mode: "insensitive" } } },
              { patient: { patientNo: { contains: search, mode: "insensitive" } } },
              { queueNo: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }],
    include: {
      department: true,
      patient: {
        include: {
          vitalSigns: { take: 1, orderBy: { capturedAt: "desc" } },
        },
      },
    },
  })

  return Response.json({
    success: true,
    data: queue.map(serializeQueueEntry),
  } satisfies ApiResponse)
}
