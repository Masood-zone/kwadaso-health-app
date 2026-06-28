import { NextRequest } from "next/server"
import { z } from "zod"

import {
  calculateBmi,
  requireNurseApi,
  serializeVitalSigns,
  writeNurseAuditLog,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const updateSchema = z.object({
  encounterId: z.string().trim().optional().nullable(),
  queueId: z.string().trim().optional().nullable(),
  temperatureC: z.coerce.number().optional().nullable(),
  systolicBp: z.coerce.number().int().optional().nullable(),
  diastolicBp: z.coerce.number().int().optional().nullable(),
  pulseRate: z.coerce.number().int().optional().nullable(),
  respiratoryRate: z.coerce.number().int().optional().nullable(),
  oxygenSaturation: z.coerce.number().int().min(0).max(100).optional().nullable(),
  weightKg: z.coerce.number().optional().nullable(),
  heightCm: z.coerce.number().optional().nullable(),
  painScore: z.coerce.number().int().min(0).max(10).optional().nullable(),
  triagePriority: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]),
  notes: z.string().trim().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; vitalId: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id, vitalId } = await context.params
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Vital signs update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.vitalSigns.findFirst({
    where: {
      id: vitalId,
      patientId: id,
      patient: { registeredFacilityId: actor!.facilityId },
    },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Vital signs record was not found." },
      { status: 404 }
    )
  }
  if (before.capturedById && before.capturedById !== actor!.id) {
    return Response.json(
      { success: false, message: "Nurse can only update vitals captured by them." },
      { status: 403 }
    )
  }

  const values = parsed.data
  const vital = await prisma.vitalSigns.update({
    where: { id: vitalId },
    data: {
      encounterId: values.encounterId || null,
      temperatureC: values.temperatureC ?? null,
      systolicBp: values.systolicBp ?? null,
      diastolicBp: values.diastolicBp ?? null,
      pulseRate: values.pulseRate ?? null,
      respiratoryRate: values.respiratoryRate ?? null,
      oxygenSaturation: values.oxygenSaturation ?? null,
      weightKg: values.weightKg ?? null,
      heightCm: values.heightCm ?? null,
      bmi: calculateBmi(values.weightKg, values.heightCm),
      painScore: values.painScore ?? null,
      triagePriority: values.triagePriority,
      notes: values.notes || null,
    },
    include: { patient: true, capturedBy: true },
  })

  if (values.queueId) {
    await prisma.patientQueue.updateMany({
      where: {
        id: values.queueId,
        patientId: id,
        department: { facilityId: actor!.facilityId },
      },
      data: { priority: values.triagePriority },
    })
  }

  await writeNurseAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "VitalSigns",
    entityId: vital.id,
    description: `Updated vitals for ${vital.patient.patientNo}`,
    before: {
      triagePriority: before.triagePriority,
      notes: before.notes,
      bmi: before.bmi?.toString() ?? null,
    },
    after: {
      triagePriority: vital.triagePriority,
      notes: vital.notes,
      bmi: vital.bmi?.toString() ?? null,
    },
  })

  return Response.json({
    success: true,
    data: serializeVitalSigns(vital),
  } satisfies ApiResponse)
}
