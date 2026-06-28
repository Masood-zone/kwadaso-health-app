import { NextRequest } from "next/server"
import { z } from "zod"

import {
  ensurePatientInFacility,
  requireNurseApi,
  serializeImmunization,
  writeNurseAuditLog,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const immunizationSchema = z.object({
  vaccineName: z.string().trim().min(1),
  dose: z.string().trim().optional().nullable(),
  batchNumber: z.string().trim().optional().nullable(),
  administeredAt: z.string().trim().min(1),
  nextDueAt: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = immunizationSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Immunization details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
  const patient = await ensurePatientInFacility(id, actor!.facilityId)
  if (!patient) {
    return Response.json(
      { success: false, message: "Patient was not found in this facility." },
      { status: 404 }
    )
  }

  const values = parsed.data
  const record = await prisma.immunizationRecord.create({
    data: {
      patientId: id,
      vaccineName: values.vaccineName,
      dose: values.dose || null,
      batchNumber: values.batchNumber || null,
      administeredAt: new Date(values.administeredAt),
      nextDueAt: values.nextDueAt ? new Date(values.nextDueAt) : null,
      notes: values.notes || null,
      administeredById: actor!.id,
    },
    include: { patient: true, administeredBy: true },
  })

  await writeNurseAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "ImmunizationRecord",
    entityId: record.id,
    description: `Recorded immunization for ${patient.patientNo}`,
    after: { patientId: id, vaccineName: record.vaccineName },
  })

  return Response.json(
    { success: true, data: serializeImmunization(record) } satisfies ApiResponse,
    { status: 201 }
  )
}
