import { z } from "zod"

export const encounterCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().nullable().optional(),
  departmentId: z.string().min(1),
  visitType: z.enum([
    "OPD",
    "EMERGENCY",
    "FOLLOW_UP",
    "MATERNAL_CHILD_HEALTH",
    "IMMUNIZATION",
    "LAB_ONLY",
    "PHARMACY_ONLY",
    "REFERRAL",
  ]),
  chiefComplaint: z.string().trim().nullable().optional(),
  queueId: z.string().nullable().optional(),
})

export const encounterUpdateSchema = z.object({
  departmentId: z.string().min(1).optional(),
  visitType: encounterCreateSchema.shape.visitType.optional(),
  chiefComplaint: z.string().trim().nullable().optional(),
  status: z.enum(["DRAFT", "IN_PROGRESS", "AWAITING_LAB", "AWAITING_PHARMACY", "CANCELLED"]).optional(),
})

export const noteSchema = z.object({
  subjective: z.string().trim().nullable().optional(),
  objective: z.string().trim().nullable().optional(),
  assessment: z.string().trim().nullable().optional(),
  plan: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  sign: z.boolean().optional(),
})

export const diagnosisSchema = z.object({
  code: z.string().trim().nullable().optional(),
  name: z.string().trim().min(1),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().nullable().optional(),
})

export const labRequestSchema = z.object({
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]),
  clinicalNotes: z.string().trim().nullable().optional(),
  tests: z.array(z.object({ testId: z.string().min(1), notes: z.string().trim().nullable().optional() })).min(1),
})

export const prescriptionItemSchema = z.object({
  medicationId: z.string().nullable().optional(),
  medicineName: z.string().trim().min(1),
  dosage: z.string().trim().nullable().optional(),
  frequency: z.string().trim().nullable().optional(),
  duration: z.string().trim().nullable().optional(),
  quantity: z.number().int().positive().nullable().optional(),
  instructions: z.string().trim().nullable().optional(),
})

export const prescriptionSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED"]),
  notes: z.string().trim().nullable().optional(),
  items: z.array(prescriptionItemSchema).min(1),
})

export const followUpSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480),
  departmentId: z.string().min(1),
  clinicianId: z.string().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  reason: z.string().trim().min(1),
})

export const referralSchema = z.object({
  toDepartmentId: z.string().nullable().optional(),
  toFacilityId: z.string().nullable().optional(),
  reason: z.string().trim().min(1),
  clinicalSummary: z.string().trim().nullable().optional(),
  urgency: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]),
})

export const queueUpdateSchema = z.object({
  status: z.enum(["WITH_CLINICIAN", "AWAITING_LAB", "AWAITING_PHARMACY", "COMPLETED", "CANCELLED"]),
  notes: z.string().trim().nullable().optional(),
  cancellationReason: z.string().trim().nullable().optional(),
})

export const messageSchema = z.object({
  threadId: z.string().optional(),
  subject: z.string().trim().min(1).optional(),
  patientId: z.string().nullable().optional(),
  encounterId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  participantIds: z.array(z.string()).default([]),
  body: z.string().trim().min(1),
})

export const notificationUpdateSchema = z.object({ status: z.enum(["READ", "ARCHIVED"]) })
export const encounterCompleteSchema = z.object({ acknowledged: z.literal(true) })

