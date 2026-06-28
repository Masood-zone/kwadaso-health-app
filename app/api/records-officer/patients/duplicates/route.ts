import { NextRequest } from "next/server"

import {
  requireRecordsOfficerApi,
  serializeRecordsPatient,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
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
              { phone: { contains: search, mode: "insensitive" } },
              { nhisNumber: { contains: search, mode: "insensitive" } },
              { nationalIdNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  })

  const matches = []
  for (let index = 0; index < patients.length; index += 1) {
    for (let next = index + 1; next < patients.length; next += 1) {
      const patient = patients[index]
      const match = patients[next]
      const fields: string[] = []
      if (patient.phone && patient.phone === match.phone) fields.push("Phone")
      if (patient.nhisNumber && patient.nhisNumber === match.nhisNumber) fields.push("NHIS")
      if (patient.nationalIdNumber && patient.nationalIdNumber === match.nationalIdNumber) fields.push("National ID")
      if (
        patient.firstName.toLowerCase() === match.firstName.toLowerCase() &&
        patient.lastName.toLowerCase() === match.lastName.toLowerCase()
      ) fields.push("Name")
      if (
        patient.dateOfBirth &&
        match.dateOfBirth &&
        patient.dateOfBirth.toDateString() === match.dateOfBirth.toDateString()
      ) fields.push("Date of birth")
      if (fields.length) {
        matches.push({
          id: `${patient.id}-${match.id}`,
          patient: serializeRecordsPatient(patient),
          match: serializeRecordsPatient(match),
          score: Math.min(100, fields.length * 24),
          matchingFields: fields,
        })
      }
    }
  }

  return Response.json({ success: true, data: matches } satisfies ApiResponse)
}
