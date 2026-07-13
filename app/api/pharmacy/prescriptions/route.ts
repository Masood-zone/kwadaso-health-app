import type { NextRequest } from "next/server"
import type { Prisma } from "@/lib/generated/prisma/client"
import { pharmacyPage, pharmacyOk, pharmacyPrescriptionInclude, parsePharmacyPagination, prescriptionScope, serializePrescriptionQueueItem, withPharmacy } from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const params = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePharmacyPagination(params)
    const search = params.get("search")?.trim()
    const prescriptionNo = params.get("prescriptionNo")?.trim()
    const status = params.get("status")
    const clinicianId = params.get("clinicianId")
    const medicationId = params.get("medicationId")
    const departmentId = params.get("departmentId")
    const dateFrom = params.get("dateFrom")
    const dateTo = params.get("dateTo")
    const where: Prisma.PrescriptionWhereInput = {
      ...prescriptionScope(actor.facilityId),
      status: status ? status as never : { in: ["ISSUED", "PARTIALLY_DISPENSED"] },
      ...(prescriptionNo ? { prescriptionNo: { contains: prescriptionNo, mode: "insensitive" } } : {}),
      ...(clinicianId ? { prescribedById: clinicianId } : {}),
      ...(medicationId ? { items: { some: { medicationId } } } : {}),
      ...(departmentId ? { encounter: { facilityId: actor.facilityId, departmentId } } : {}),
      ...((dateFrom || dateTo) ? { issuedAt: { ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}), ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}) } } : {}),
      ...(search ? { patient: { registeredFacilityId: actor.facilityId, OR: [{ patientNo: { contains: search, mode: "insensitive" } }, { firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }] } } : {}),
    }
    const [rows, total] = await Promise.all([prisma.prescription.findMany({ where, include: pharmacyPrescriptionInclude, orderBy: [{ issuedAt: "asc" }, { createdAt: "asc" }], skip, take: pageSize }), prisma.prescription.count({ where })])
    return pharmacyOk(pharmacyPage(rows.map(serializePrescriptionQueueItem), total, page, pageSize))
  })
}

