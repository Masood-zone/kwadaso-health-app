import type { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import { billingOk, pageData, parsePagination, serializePatientListItem, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")?.trim()
    const { page, pageSize, skip } = parsePagination(searchParams)
    const where: Prisma.PatientWhereInput = {
      registeredFacilityId: actor.facilityId,
      ...(search ? {
        OR: [
          { patientNo: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { otherNames: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { nhisNumber: { contains: search, mode: "insensitive" } },
          { invoices: { some: { invoiceNo: { contains: search, mode: "insensitive" }, facilityId: actor.facilityId } } },
        ],
      } : {}),
    }
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: { invoices: { where: { facilityId: actor.facilityId }, include: { payments: { select: { paidAt: true } } }, orderBy: { createdAt: "desc" } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.patient.count({ where }),
    ])
    const items = await Promise.all(patients.map(serializePatientListItem))
    return billingOk(pageData(items, total, page, pageSize))
  })
}
