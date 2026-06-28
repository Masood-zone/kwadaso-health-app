import { NextRequest } from "next/server"
import { z } from "zod"

import {
  generatePatientNo,
  requireRecordsOfficerApi,
  serializeRecordsPatient,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const patientSchema = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    otherNames: z.string().trim().optional().nullable(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
    dateOfBirth: z.string().datetime().optional().nullable(),
    estimatedAge: z.coerce.number().int().min(0).max(130).optional().nullable(),
    maritalStatus: z
      .enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED", "UNKNOWN"])
      .optional(),
    bloodGroup: z
      .enum([
        "A_POSITIVE",
        "A_NEGATIVE",
        "B_POSITIVE",
        "B_NEGATIVE",
        "AB_POSITIVE",
        "AB_NEGATIVE",
        "O_POSITIVE",
        "O_NEGATIVE",
        "UNKNOWN",
      ])
      .optional(),
    occupation: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    residentialAddress: z.string().trim().optional().nullable(),
    community: z.string().trim().optional().nullable(),
    nhisNumber: z.string().trim().optional().nullable(),
    nationalIdNumber: z.string().trim().optional().nullable(),
    emergencyContactName: z.string().trim().optional().nullable(),
    emergencyContactPhone: z.string().trim().optional().nullable(),
    emergencyContactRelation: z.string().trim().optional().nullable(),
  })
  .refine((data) => Boolean(data.phone || data.emergencyContactPhone), {
    message: "Phone or emergency contact phone is required.",
    path: ["phone"],
  })
  .refine((data) => Boolean(data.residentialAddress || data.community), {
    message: "Residential address or community is required.",
    path: ["community"],
  })

async function ensureUniqueIdentifiers({
  nhisNumber,
  nationalIdNumber,
  excludeId,
}: {
  nhisNumber?: string | null
  nationalIdNumber?: string | null
  excludeId?: string
}) {
  if (nhisNumber) {
    const match = await prisma.patient.findFirst({
      where: { nhisNumber, ...(excludeId ? { id: { not: excludeId } } : {}) },
    })
    if (match) return "NHIS number already belongs to another patient."
  }
  if (nationalIdNumber) {
    const match = await prisma.patient.findFirst({
      where: {
        nationalIdNumber,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
    if (match) return "National ID number already belongs to another patient."
  }
  return null
}

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get("search")?.trim()
  const patientNo = searchParams.get("patientNo")?.trim()
  const nhisNumber = searchParams.get("nhisNumber")?.trim()
  const nationalIdNumber = searchParams.get("nationalIdNumber")?.trim()
  const phone = searchParams.get("phone")?.trim()
  const gender = searchParams.get("gender")
  const status = searchParams.get("status")
  const community = searchParams.get("community")?.trim()
  const registeredFrom = searchParams.get("registeredFrom")
  const registeredTo = searchParams.get("registeredTo")

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
      ...(patientNo ? { patientNo: { contains: patientNo, mode: "insensitive" } } : {}),
      ...(nhisNumber ? { nhisNumber: { contains: nhisNumber, mode: "insensitive" } } : {}),
      ...(nationalIdNumber
        ? { nationalIdNumber: { contains: nationalIdNumber, mode: "insensitive" } }
        : {}),
      ...(phone ? { phone: { contains: phone, mode: "insensitive" } } : {}),
      ...(gender ? { gender: gender as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(community ? { community: { contains: community, mode: "insensitive" } } : {}),
      ...(registeredFrom || registeredTo
        ? {
            createdAt: {
              ...(registeredFrom ? { gte: new Date(registeredFrom) } : {}),
              ...(registeredTo ? { lte: new Date(registeredTo) } : {}),
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  })

  return Response.json({
    success: true,
    data: patients.map(serializeRecordsPatient),
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const parsed = patientSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Patient details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const values = parsed.data
  const uniqueError = await ensureUniqueIdentifiers(values)
  if (uniqueError) {
    return Response.json({ success: false, message: uniqueError }, { status: 400 })
  }

  const patient = await prisma.patient.create({
    data: {
      patientNo: await generatePatientNo(actor!.facilityId),
      firstName: values.firstName,
      lastName: values.lastName,
      otherNames: values.otherNames || null,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth) : null,
      estimatedAge: values.estimatedAge ?? null,
      maritalStatus: values.maritalStatus ?? "UNKNOWN",
      bloodGroup: values.bloodGroup ?? "UNKNOWN",
      occupation: values.occupation || null,
      phone: values.phone || null,
      email: values.email || null,
      residentialAddress: values.residentialAddress || null,
      community: values.community || null,
      nhisNumber: values.nhisNumber || null,
      nationalIdNumber: values.nationalIdNumber || null,
      emergencyContactName: values.emergencyContactName || null,
      emergencyContactPhone: values.emergencyContactPhone || null,
      emergencyContactRelation: values.emergencyContactRelation || null,
      registeredFacilityId: actor!.facilityId,
      registeredById: actor!.id,
      status: "ACTIVE",
    },
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "Patient",
    entityId: patient.id,
    description: `Registered patient ${patient.patientNo}`,
    after: {
      patientNo: patient.patientNo,
      name: `${patient.firstName} ${patient.lastName}`,
      registeredFacilityId: patient.registeredFacilityId,
    },
  })

  return Response.json(
    { success: true, data: serializeRecordsPatient(patient) } satisfies ApiResponse,
    { status: 201 }
  )
}
