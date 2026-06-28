import { NextRequest } from "next/server"
import { z } from "zod"

import {
  calculateBmi,
  requireNurseApi,
  serializeQueueEntry,
  writeNurseAuditLog,
} from "@/lib/nurse"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const emergencySchema = z.object({
  reason: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
  notifyClinician: z.boolean().optional(),
  vitalSigns: z
    .object({
      temperatureC: z.coerce.number().optional().nullable(),
      systolicBp: z.coerce.number().int().optional().nullable(),
      diastolicBp: z.coerce.number().int().optional().nullable(),
      pulseRate: z.coerce.number().int().optional().nullable(),
      respiratoryRate: z.coerce.number().int().optional().nullable(),
      oxygenSaturation: z.coerce.number().int().min(0).max(100).optional().nullable(),
      weightKg: z.coerce.number().optional().nullable(),
      heightCm: z.coerce.number().optional().nullable(),
      painScore: z.coerce.number().int().min(0).max(10).optional().nullable(),
      notes: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireNurseApi(request)
  if (response) return response
  const { id } = await context.params
  const parsed = emergencySchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Emergency flag details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.patientQueue.findFirst({
    where: { id, department: { facilityId: actor!.facilityId } },
    include: { patient: true, department: true },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Queue item was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  if (values.vitalSigns) {
    await prisma.vitalSigns.create({
      data: {
        patientId: before.patientId,
        temperatureC: values.vitalSigns.temperatureC ?? null,
        systolicBp: values.vitalSigns.systolicBp ?? null,
        diastolicBp: values.vitalSigns.diastolicBp ?? null,
        pulseRate: values.vitalSigns.pulseRate ?? null,
        respiratoryRate: values.vitalSigns.respiratoryRate ?? null,
        oxygenSaturation: values.vitalSigns.oxygenSaturation ?? null,
        weightKg: values.vitalSigns.weightKg ?? null,
        heightCm: values.vitalSigns.heightCm ?? null,
        bmi: calculateBmi(values.vitalSigns.weightKg, values.vitalSigns.heightCm),
        painScore: values.vitalSigns.painScore ?? null,
        triagePriority: "EMERGENCY",
        notes: values.vitalSigns.notes || values.notes || values.reason,
        capturedById: actor!.id,
        capturedAt: new Date(),
      },
    })
  }

  const queue = await prisma.patientQueue.update({
    where: { id },
    data: {
      priority: "EMERGENCY",
      status: "IN_TRIAGE",
      notes: [values.reason, values.notes].filter(Boolean).join(" - "),
    },
    include: {
      department: true,
      patient: {
        include: {
          vitalSigns: { take: 1, orderBy: { capturedAt: "desc" } },
        },
      },
    },
  })

  if (values.notifyClinician ?? true) {
    await prisma.notification.createMany({
      data: ["DOCTOR", "PHYSICIAN_ASSISTANT", "HOSPITAL_ADMIN"].map((role) => ({
        facilityId: actor!.facilityId,
        createdById: actor!.id,
        targetRole: role as never,
        type: "CRITICAL_ALERT",
        priority: "URGENT",
        title: `Emergency triage: ${queue.patient.firstName} ${queue.patient.lastName}`,
        body: values.reason,
        actionUrl: `/nurse/patients/${queue.patientId}`,
        entityType: "PatientQueue",
        entityId: queue.id,
      })),
    })
  }

  await writeNurseAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "PatientQueue",
    entityId: queue.id,
    description: `Flagged ${queue.queueNo} as emergency`,
    before: { status: before.status, priority: before.priority, notes: before.notes },
    after: { status: queue.status, priority: queue.priority, notes: queue.notes },
  })

  return Response.json({
    success: true,
    data: serializeQueueEntry(queue),
  } satisfies ApiResponse)
}
