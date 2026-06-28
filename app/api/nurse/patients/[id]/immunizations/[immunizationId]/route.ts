import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireNurseApi,
  serializeImmunization,
  writeNurseAuditLog,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  vaccineName: z.string().trim().min(1),
  dose: z.string().trim().optional().nullable(),
  batchNumber: z.string().trim().optional().nullable(),
  administeredAt: z.string().trim().min(1),
  nextDueAt: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; immunizationId: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id, immunizationId } = await context.params
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Immunization update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.immunizationRecord.findFirst({
    where: {
      id: immunizationId,
      patientId: id,
      patient: { registeredFacilityId: actor!.facilityId },
    },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Immunization record was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  const record = await prisma.immunizationRecord.update({
    where: { id: immunizationId },
    data: {
      vaccineName: values.vaccineName,
      dose: values.dose || null,
      batchNumber: values.batchNumber || null,
      administeredAt: new Date(values.administeredAt),
      nextDueAt: values.nextDueAt ? new Date(values.nextDueAt) : null,
      notes: values.notes || null,
    },
    include: { patient: true, administeredBy: true },
  })

  await writeNurseAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "ImmunizationRecord",
    entityId: record.id,
    description: `Updated immunization for ${record.patient.patientNo}`,
    before: { vaccineName: before.vaccineName, notes: before.notes },
    after: { vaccineName: record.vaccineName, notes: record.notes },
  })

  return Response.json({
    success: true,
    data: serializeImmunization(record),
  } satisfies ApiResponse)
}
