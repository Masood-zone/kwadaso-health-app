import { z } from "zod"

const nullableText = z.string().trim().nullable().optional()
const money = z.number().nonnegative().nullable().optional()

export const medicationCreateSchema = z.object({
  code: nullableText,
  name: z.string().trim().min(1),
  genericName: nullableText,
  category: nullableText,
  dosageForm: nullableText,
  strength: nullableText,
  unit: nullableText,
  reorderLevel: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
})
export const medicationUpdateSchema = medicationCreateSchema.partial()

export const stockCreateSchema = z.object({
  medicationId: z.string().min(1),
  batchNumber: nullableText,
  expiryDate: z.string().datetime().nullable().optional(),
  quantityOnHand: z.number().int().nonnegative(),
  unitCost: money,
  sellingPrice: money,
  reference: nullableText,
})
export const stockUpdateSchema = z.object({
  batchNumber: nullableText,
  expiryDate: z.string().datetime().nullable().optional(),
  unitCost: money,
  sellingPrice: money,
})

export const stockMovementSchema = z.object({
  type: z.enum([
    "PURCHASE",
    "DONATION",
    "ADJUSTMENT_IN",
    "TRANSFER_OUT",
    "TRANSFER_IN",
    "ADJUSTMENT_OUT",
  ]),
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(1),
  reference: nullableText,
  reversalOfMovementId: z.string().nullable().optional(),
})

export const stockWriteOffSchema = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(1),
  reference: nullableText,
})

export const dispensingCreateSchema = z.object({
  items: z
    .array(
      z.object({
        prescriptionItemId: z.string().min(1),
        medicationId: z.string().min(1),
        stockId: z.string().min(1),
        quantityDispensed: z.number().int().positive(),
        notes: nullableText,
      })
    )
    .min(1),
  notes: nullableText,
  counsellingNotes: nullableText,
  partialDispenseReason: nullableText,
  safetyOverrides: z
    .array(
      z.object({
        type: z.enum(["ALLERGY", "DUPLICATE_MEDICATION"]),
        prescriptionItemId: z.string().optional(),
        reason: z.string().trim().min(1),
      })
    )
    .optional(),
})

export const dispensingUpdateSchema = z.object({
  notes: nullableText,
  counsellingNotes: nullableText,
  cancel: z.boolean().optional(),
  cancellationReason: nullableText,
})
export const prescriptionCancelSchema = z.object({
  status: z.literal("CANCELLED"),
  cancellationReason: z.string().trim().min(1),
})
export const prescriptionExternalReleaseSchema = z.object({
  reason: z.string().trim().min(3),
})

export const reorderCreateSchema = z.object({
  requestedQuantity: z.number().int().positive(),
  notes: nullableText,
  reference: nullableText,
})
export const reorderUpdateSchema = z.object({
  status: z.enum(["REQUESTED", "ORDERED", "RECEIVED", "CANCELLED"]),
  notes: nullableText,
})
export const notificationUpdateSchema = z.object({
  status: z.enum(["READ", "ARCHIVED"]),
})
