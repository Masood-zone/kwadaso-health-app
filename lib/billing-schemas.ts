import { z } from "zod"

const money = z.coerce.number().finite().nonnegative().multipleOf(0.01)
const optionalText = z.string().trim().max(1000).nullable().optional()

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(2).max(250),
  itemType: z.string().trim().min(2).max(80),
  quantity: z.coerce.number().int().positive().max(100000),
  unitPrice: money,
  referenceId: z.string().trim().min(1).nullable().optional(),
  sourceKey: z.string().trim().min(3).max(200).nullable().optional(),
})

export const invoiceCreateSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().min(1).nullable().optional(),
  items: z.array(invoiceItemSchema).min(1).max(100),
  discountAmount: money.default(0),
  taxAmount: money.default(0),
  notes: optionalText,
})

export const invoiceUpdateSchema = z.object({
  items: z.array(invoiceItemSchema).min(1).max(100).optional(),
  discountAmount: money.optional(),
  taxAmount: money.optional(),
  notes: optionalText,
  status: z.enum(["ISSUED", "CANCELLED", "VOID"]).optional(),
  reason: z.string().trim().min(3).max(500).optional(),
  replacementInvoiceId: z.string().min(1).nullable().optional(),
})

export const paymentCreateSchema = z.object({
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER", "NHIS", "WAIVER", "OTHER"]),
  amount: z.coerce.number().finite().positive().multipleOf(0.01),
  reference: z.string().trim().max(150).nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  notes: optionalText,
  approvalReference: z.string().trim().max(150).nullable().optional(),
  approvedById: z.string().min(1).nullable().optional(),
})

export const paymentReversalSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  reference: z.string().trim().max(150).nullable().optional(),
  confirmed: z.literal(true),
})

export const notificationUpdateSchema = z.object({
  status: z.enum(["READ", "ARCHIVED"]),
})

export const reportExportSchema = z.object({
  reportType: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(200),
  dateFrom: z.string().date().nullable().optional(),
  dateTo: z.string().date().nullable().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
})

export const documentEventSchema = z.object({
  documentType: z.enum(["INVOICE", "RECEIPT", "STATEMENT", "REPORT"]),
  documentId: z.string().min(1),
  action: z.enum(["PRINT", "EXPORT"]),
})
