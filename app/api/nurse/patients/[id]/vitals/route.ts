import { NextRequest } from "next/server"
import { z } from "zod"

import {
  calculateBmi,
  ensurePatientInFacility,
  requireNurseApi,
  serializeVitalSigns,
  writeNurseAuditLog,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const vitalsSchema = z.object({
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id } = await context.params

  const patient = await ensurePatientInFacility(id, actor!.facilityId)
  if (!patient) {
    return Response.json(
      { success: false, message: "Patient was not found in this facility." },
      { status: 404 }
    )
  }

  const vitals = await prisma.vitalSigns.findMany({
    where: { patientId: id },
    orderBy: { capturedAt: "desc" },
    include: { patient: true, capturedBy: true },
  })

  return Response.json({
    success: true,
    data: vitals.map(serializeVitalSigns),
  } satisfies ApiResponse)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = vitalsSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Vital signs are invalid.",
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
  if (values.queueId) {
    const queue = await prisma.patientQueue.findFirst({
      where: {
        id: values.queueId,
        patientId: id,
        department: { facilityId: actor!.facilityId },
      },
    })
    if (!queue) {
      return Response.json(
        { success: false, message: "Queue item was not found for this patient." },
        { status: 404 }
      )
    }
  }

  const vital = await prisma.vitalSigns.create({
    data: {
      patientId: id,
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
      capturedById: actor!.id,
      capturedAt: new Date(),
    },
    include: { patient: true, capturedBy: true },
  })

  if (values.queueId) {
    await prisma.patientQueue.update({
      where: { id: values.queueId },
      data: { priority: values.triagePriority },
    })
  }

  await writeNurseAuditLog({
    request,
    actor: actor!,
    action: "CREATE",
    entityType: "VitalSigns",
    entityId: vital.id,
    description: `Captured vitals for ${patient.patientNo}`,
    after: {
      patientId: id,
      triagePriority: vital.triagePriority,
      bmi: vital.bmi?.toString() ?? null,
    },
  })

  return Response.json(
    { success: true, data: serializeVitalSigns(vital) } satisfies ApiResponse,
    { status: 201 }
  )
}
