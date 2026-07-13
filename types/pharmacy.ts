import type {
  DispenseStatus,
  NotificationStatus,
  NotificationType,
  PharmacyReorderStatus,
  PrescriptionStatus,
  StockMovementType,
} from "@/lib/generated/prisma/enums"

export type PharmacyPage<T> = { items: T[]; total: number; page: number; pageSize: number }

export type PharmacyMetric = { label: string; value: number | string; detail: string; tone: "green" | "orange" | "red" | "blue" }
export type PharmacyDashboardSummary = {
  metrics: PharmacyMetric[]
  recentDispensing: DispensingListItem[]
  lowStock: MedicationStockItem[]
}

export type PrescriptionFilters = {
  search?: string
  prescriptionNo?: string
  status?: PrescriptionStatus
  clinicianId?: string
  medicationId?: string
  departmentId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type PrescriptionQueueItem = {
  id: string
  prescriptionNo: string
  patientId: string
  patientName: string
  patientNo: string
  prescribedByName: string | null
  medicationCount: number
  status: PrescriptionStatus
  issuedAt: string | null
  billingStatus: string | null
}

export type PharmacySafetyWarning = {
  type: "ALLERGY" | "DUPLICATE_MEDICATION" | "LOW_STOCK" | "EXPIRED_STOCK" | "INSUFFICIENT_STOCK"
  level: "warning" | "block"
  prescriptionItemId?: string
  medicationId?: string | null
  message: string
  requiresReason: boolean
}

export type PrescriptionDetail = PrescriptionQueueItem & {
  notes: string | null
  patient: {
    id: string
    patientNo: string
    name: string
    gender: string
    allergies: { allergen: string; severity: string; reaction: string | null }[]
    chronicConditions: { name: string; status: string | null }[]
    medicationHistory: { medicationName: string; dosage: string | null; frequency: string | null; startDate: string | null; endDate: string | null }[]
  }
  encounter: { id: string; encounterNo: string; chiefComplaint: string | null; departmentName: string; diagnoses: string[] } | null
  items: Array<{
    id: string
    medicationId: string | null
    medicineName: string
    dosage: string | null
    frequency: string | null
    duration: string | null
    quantity: number | null
    instructions: string | null
    dispensedQuantity: number
    remainingQuantity: number
    batches: Array<{ id: string; batchNumber: string | null; expiryDate: string | null; quantityOnHand: number; sellingPrice: number | null }>
  }>
  warnings: PharmacySafetyWarning[]
  dispensings: DispensingListItem[]
  cancellationReason: string | null
  timeline: Array<{ label: string; at: string; detail?: string | null; tone: string }>
}

export type DispenseItemPayload = {
  prescriptionItemId: string
  medicationId: string
  stockId: string
  quantityDispensed: number
  notes?: string | null
}

export type DispensingCreatePayload = {
  items: DispenseItemPayload[]
  notes?: string | null
  counsellingNotes?: string | null
  partialDispenseReason?: string | null
  safetyOverrides?: Array<{ type: "ALLERGY" | "DUPLICATE_MEDICATION"; prescriptionItemId?: string; reason: string }>
}

export type DispensingUpdatePayload = { notes?: string | null; counsellingNotes?: string | null; cancel?: boolean; cancellationReason?: string | null }

export type DispensingListItem = {
  id: string
  dispenseNo: string
  prescriptionId: string
  prescriptionNo: string
  patientId: string
  patientName: string
  status: DispenseStatus
  dispensedByName: string | null
  dispensedAt: string | null
  itemCount: number
}

export type MedicationCatalogItem = {
  id: string
  code: string | null
  name: string
  genericName: string | null
  category: string | null
  dosageForm: string | null
  strength: string | null
  unit: string | null
  reorderLevel: number
  isActive: boolean
  stockQuantity: number
}

export type MedicationCreatePayload = Omit<MedicationCatalogItem, "id" | "stockQuantity"> 
export type MedicationUpdatePayload = Partial<MedicationCreatePayload>

export type MedicationStockItem = {
  id: string
  medicationId: string
  medicationName: string
  genericName: string | null
  category: string | null
  batchNumber: string | null
  expiryDate: string | null
  quantityOnHand: number
  reorderLevel: number
  unitCost: number | null
  sellingPrice: number | null
  stockStatus: "AVAILABLE" | "LOW" | "EXPIRED" | "OUT"
}

export type StockCreatePayload = { medicationId: string; batchNumber?: string | null; expiryDate?: string | null; quantityOnHand: number; unitCost?: number | null; sellingPrice?: number | null; reference?: string | null }
export type StockUpdatePayload = { batchNumber?: string | null; expiryDate?: string | null; unitCost?: number | null; sellingPrice?: number | null }
export type StockMovementPayload = { type: StockMovementType; quantity: number; reason: string; reference?: string | null; reversalOfMovementId?: string | null }

export type StockMovementItem = {
  id: string
  stockId: string
  medicationId: string
  medicationName: string
  batchNumber: string | null
  type: StockMovementType
  quantity: number
  reason: string | null
  reference: string | null
  performedByName: string | null
  reversalOfId: string | null
  createdAt: string
}

export type PharmacyReorderItem = {
  id: string
  reference: string
  medicationId: string
  medicationName: string
  stockId: string | null
  requestedQuantity: number
  status: PharmacyReorderStatus
  notes: string | null
  createdByName: string | null
  createdAt: string
}

export type PharmacyReportFilters = { type?: string; dateFrom?: string; dateTo?: string; medicationId?: string; category?: string; movementType?: StockMovementType; pharmacistId?: string }
export type PharmacyNotificationItem = { id: string; type: NotificationType; status: NotificationStatus; priority: string; title: string; body: string | null; actionUrl: string | null; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string }

