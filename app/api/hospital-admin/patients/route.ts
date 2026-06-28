import { NextRequest } from "next/server"

import { requireHospitalAdminApi } from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { HospitalAdminPatientLookupItem } from "@/types/hospital-admin"

function getAge(dateOfBirth: Date | null, estimatedAge: number | null) {
  if (estimatedAge) return estimatedAge
  if (!dateOfBirth) return null

  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDelta = today.getMonth() - dateOfBirth.getMonth()
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1
  }
  return age
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const search = request.nextUrl.searchParams.get("search")?.trim()

  const patients = await prisma.patient.findMany({
    where: {
      registeredFacilityId: actor!.facilityId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { otherNames: { contains: search, mode: "insensitive" } },
              { patientNo: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { nhisNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 12,
    select: {
      id: true,
      patientNo: true,
      firstName: true,
      lastName: true,
      gender: true,
      dateOfBirth: true,
      estimatedAge: true,
      phone: true,
      nhisNumber: true,
      status: true,
    },
  })

  const data: HospitalAdminPatientLookupItem[] = patients.map((patient) => ({
    id: patient.id,
    patientNo: patient.patientNo,
    firstName: patient.firstName,
    lastName: patient.lastName,
    name: `${patient.firstName} ${patient.lastName}`,
    gender: patient.gender,
    age: getAge(patient.dateOfBirth, patient.estimatedAge),
    phone: patient.phone,
    nhisNumber: patient.nhisNumber,
    status: patient.status,
  }))

  return Response.json({ success: true, data } satisfies ApiResponse)
}
