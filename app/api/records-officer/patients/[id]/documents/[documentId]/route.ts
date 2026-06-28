import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireRecordsOfficerApi,
  serializeRecordsDocument,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  type: z.enum(["REFERRAL_NOTE", "LAB_ATTACHMENT", "SCANNED_RECORD", "CONSENT_FORM", "INSURANCE_DOCUMENT", "OTHER"]),
  title: z.string().trim().min(1),
  fileUrl: z.string().trim().optional(),
  fileName: z.string().trim().optional().nullable(),
  mimeType: z.string().trim().optional().nullable(),
  sizeBytes: z.coerce.number().int().min(0).optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id, documentId } = await context.params
  const before = await prisma.patientDocument.findFirst({
    where: {
      id: documentId,
      patientId: id,
      patient: { registeredFacilityId: actor!.facilityId },
    },
  })
  if (!before) {
    return Response.json({ success: false, message: "Document was not found." }, { status: 404 })
  }

  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Document update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const values = parsed.data
  const document = await prisma.patientDocument.update({
    where: { id: documentId },
    data: {
      type: values.type,
      title: values.title,
      fileUrl: values.fileUrl || before.fileUrl,
      fileName: values.fileName ?? before.fileName,
      mimeType: values.mimeType ?? before.mimeType,
      sizeBytes: values.sizeBytes ?? before.sizeBytes,
    },
    include: { uploadedBy: true },
  })

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "PatientDocument",
    entityId: document.id,
    description: `Updated document ${document.title}`,
    before: { title: before.title, type: before.type },
    after: { title: document.title, type: document.type },
  })

  return Response.json({ success: true, data: serializeRecordsDocument(document) } satisfies ApiResponse)
}
