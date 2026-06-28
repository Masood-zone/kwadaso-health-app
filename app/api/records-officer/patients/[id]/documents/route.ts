import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireRecordsOfficerApi,
  serializeRecordsDocument,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const documentSchema = z.object({
  type: z.enum(["REFERRAL_NOTE", "LAB_ATTACHMENT", "SCANNED_RECORD", "CONSENT_FORM", "INSURANCE_DOCUMENT", "OTHER"]),
  title: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
  fileName: z.string().trim().optional().nullable(),
  mimeType: z.string().trim().optional().nullable(),
  sizeBytes: z.coerce.number().int().min(0).optional().nullable(),
})

async function findPatient(id: string, facilityId: string) {
  return prisma.patient.findFirst({ where: { id, registeredFacilityId: facilityId } })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id } = await context.params
  const patient = await findPatient(id, actor!.facilityId)
  if (!patient) return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })

  const documents = await prisma.patientDocument.findMany({
    where: { patientId: id },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: true },
  })

  return Response.json({ success: true, data: documents.map(serializeRecordsDocument) } satisfies ApiResponse)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id } = await context.params
  const patient = await findPatient(id, actor!.facilityId)
  if (!patient) return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })

  const parsed = documentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Document details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const values = parsed.data
  const document = await prisma.patientDocument.create({
    data: {
      patientId: id,
      type: values.type,
      title: values.title,
      fileUrl: values.fileUrl,
      fileName: values.fileName || null,
      mimeType: values.mimeType || null,
      sizeBytes: values.sizeBytes ?? null,
      uploadedById: actor!.id,
    },
    include: { uploadedBy: true },
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "PatientDocument",
    entityId: document.id,
    description: `Uploaded document for patient ${patient.patientNo}`,
    after: { patientId: id, title: document.title, type: document.type },
  })

  return Response.json(
    { success: true, data: serializeRecordsDocument(document) } satisfies ApiResponse,
    { status: 201 }
  )
}
