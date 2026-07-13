import { z } from "zod"

export const laboratoryResultParameterSchema = z.object({
  parameterDefinitionId: z.string().nullable().optional(),
  parameterName: z.string().trim().min(1),
  value: z.string().trim().nullable().optional(),
  unit: z.string().trim().nullable().optional(),
  referenceRange: z.string().trim().nullable().optional(),
  isAbnormal: z.boolean().optional(),
  isCritical: z.boolean().optional(),
})

export const laboratoryResultPayloadSchema = z.object({
  labSampleId: z.string().min(1),
  resultText: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  status: z.enum(["DRAFT", "ENTERED"]),
  abnormalFlag: z.boolean().optional(),
  criticalFlag: z.boolean().optional(),
  parameters: z.array(laboratoryResultParameterSchema).default([]),
})

export const laboratoryCatalogParameterSchema = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().nullable().optional(),
  referenceRange: z.string().trim().nullable().optional(),
  referenceLow: z.number().nullable().optional(),
  referenceHigh: z.number().nullable().optional(),
  criticalLow: z.number().nullable().optional(),
  criticalHigh: z.number().nullable().optional(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const laboratoryCatalogSchema = z.object({
  code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1),
  category: z.string().trim().nullable().optional(),
  sampleType: z.string().trim().nullable().optional(),
  unit: z.string().trim().nullable().optional(),
  referenceRange: z.string().trim().nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  turnaroundHours: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
  parameters: z.array(laboratoryCatalogParameterSchema).default([]),
})
