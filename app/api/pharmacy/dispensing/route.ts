import type { NextRequest } from "next/server"
import type { Prisma } from "@/lib/generated/prisma/client"
import { pharmacyDispensingInclude, pharmacyOk, pharmacyPage, parsePharmacyPagination, serializeDispensing, withPharmacy } from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const params = request.nextUrl.searchParams; const { page, pageSize, skip } = parsePharmacyPagination(params)
    const search = params.get("search")?.trim(); const status = params.get("status")
    const where: Prisma.DispensingWhereInput = { patient: { registeredFacilityId: actor.facilityId, ...(search ? { OR: [{ patientNo: { contains: search, mode: "insensitive" } }, { firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }] } : {}) }, ...(status ? { status: status as never } : {}) }
    const [rows, total] = await Promise.all([prisma.dispensing.findMany({ where, include: pharmacyDispensingInclude, orderBy: { createdAt: "desc" }, skip, take: pageSize }), prisma.dispensing.count({ where })])
    return pharmacyOk(pharmacyPage(rows.map(serializeDispensing), total, page, pageSize))
  })
}

