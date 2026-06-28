import { NextRequest } from "next/server"
import { z } from "zod"

import {
  getRecordsPatientProfile,
  requireRecordsOfficerApi,
  serializeRecordsPatient,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  otherNames: z.string().trim().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  dateOfBirth: z.string().datetime().optional().nullable(),
  estimatedAge: z.coerce.number().int().min(0).max(130).optional().nullable(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED", "UNKNOWN"]).optional(),
  bloodGroup: z.enum(["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE", "UNKNOWN"]).optional(),
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
  status: z.enum(["ACTIVE", "DECEASED", "ARCHIVED"]).optional(),
  updateReason: z.string().trim().optional().nullable(),
})

async function uniqueError(nhisNumber?: string | null, nationalIdNumber?: string | null, id?: string) {
  if (nhisNumber) {
    const match = await prisma.patient.findFirst({ where: { nhisNumber, id: { not: id } } })
    if (match) return "NHIS number already belongs to another patient."
  }
  if (nationalIdNumber) {
    const match = await prisma.patient.findFirst({ where: { nationalIdNumber, id: { not: id } } })
    if (match) return "National ID number already belongs to another patient."
  }
  return null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id } = await context.params
  const profile = await getRecordsPatientProfile(id, actor!.facilityId)
  if (!profile) {
    return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })
  }

  return Response.json({ success: true, data: profile } satisfies ApiResponse)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id } = await context.params
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Patient update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.patient.findFirst({
    where: { id, registeredFacilityId: actor!.facilityId },
  })
  if (!before) {
    return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })
  }

  const values = parsed.data
  const error = await uniqueError(values.nhisNumber, values.nationalIdNumber, id)
  if (error) {
    return Response.json({ success: false, message: error }, { status: 400 })
  }

  const patient = await prisma.patient.update({
    where: { id },
    data: {
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
      status: values.status ?? before.status,
    },
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "Patient",
    entityId: patient.id,
    description: `Updated patient ${patient.patientNo}`,
    before: {
      firstName: before.firstName,
      lastName: before.lastName,
      phone: before.phone,
      status: before.status,
    },
    after: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
      status: patient.status,
      updateReason: values.updateReason ?? null,
    },
  })

  return Response.json({ success: true, data: serializeRecordsPatient(patient) } satisfies ApiResponse)
}
