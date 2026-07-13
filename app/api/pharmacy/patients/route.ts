import type { NextRequest } from "next/server"
import { fullName, pharmacyOk, withPharmacy } from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => { const search = request.nextUrl.searchParams.get("search")?.trim(); const rows = await prisma.patient.findMany({ where: { registeredFacilityId: actor.facilityId, status: "ACTIVE", ...(search ? { OR: [{ patientNo: { contains: search, mode: "insensitive" } }, { firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } }] } : {}) }, include: { allergies: true, prescriptions: { orderBy: { createdAt: "desc" }, take: 1 }, dispensings: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 100 }); return pharmacyOk(rows.map((patient) => ({ id: patient.id, patientNo: patient.patientNo, name: fullName(patient), gender: patient.gender, phone: patient.phone, community: patient.community, allergies: patient.allergies.map((item) => item.allergen), latestPrescriptionStatus: patient.prescriptions[0]?.status ?? null, latestDispensingAt: patient.dispensings[0]?.dispensedAt?.toISOString() ?? null }))) })
}

