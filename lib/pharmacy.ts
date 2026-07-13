import type { NextRequest } from "next/server"

import type { AuthenticatedStaff } from "@/lib/auth-session"
import { requireRoleApi } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  AuditAction,
  NotificationStatus,
  NotificationType,
  StaffRole,
} from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import type {
  DispensingListItem,
  MedicationCatalogItem,
  MedicationStockItem,
  PharmacyNotificationItem,
  PharmacyPage,
  PharmacySafetyWarning,
  PrescriptionDetail,
  PrescriptionQueueItem,
  StockMovementItem,
} from "@/types/pharmacy"

type DbClient = Prisma.TransactionClient | typeof prisma

export const pharmacyPrescriptionInclude = {
  patient: {
    include: {
      allergies: true,
      chronicConditions: true,
      medicationHistory: true,
    },
  },
  encounter: {
    include: {
      department: true,
      diagnoses: true,
      invoices: {
        include: { items: true, payments: true },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
  prescribedBy: true,
  externallyReleasedBy: true,
  items: { include: { medication: true } },
  dispensings: {
    include: {
      prescription: true,
      patient: true,
      dispensedBy: true,
      items: { include: { medication: true, stock: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.PrescriptionInclude

export const pharmacyDispensingInclude = {
  prescription: { include: { patient: true } },
  patient: true,
  dispensedBy: true,
  cancelledBy: true,
  items: { include: { medication: true, stock: true, prescriptionItem: true } },
} satisfies Prisma.DispensingInclude

export const pharmacyStockInclude = {
  medication: true,
  movements: {
    include: { performedBy: true },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.MedicationStockInclude

type PrescriptionRecord = Prisma.PrescriptionGetPayload<{
  include: typeof pharmacyPrescriptionInclude
}>
type DispensingRecord = Prisma.DispensingGetPayload<{
  include: typeof pharmacyDispensingInclude
}>
type StockRecord = Prisma.MedicationStockGetPayload<{
  include: typeof pharmacyStockInclude
}>

export async function requirePharmacyApi(request: NextRequest) {
  const result = await requireRoleApi(request, [StaffRole.PHARMACIST])
  if (result.response) return result
  if (!result.staff?.facilityId)
    return {
      staff: result.staff,
      response: Response.json(
        {
          success: false,
          message: "Pharmacist is not assigned to a facility.",
          code: "FACILITY_REQUIRED",
        },
        { status: 403 }
      ),
    }
  return result
}

export async function withPharmacy(
  request: NextRequest,
  handler: (actor: AuthenticatedStaff) => Promise<Response>
) {
  const { staff, response } = await requirePharmacyApi(request)
  if (response) return response
  try {
    return await handler(staff!)
  } catch (error) {
    return pharmacyError(error)
  }
}

export function pharmacyOk(data: unknown, message?: string, status = 200) {
  return Response.json(
    { success: true, data, ...(message ? { message } : {}) },
    { status }
  )
}

const pharmacyErrors: Record<string, [string, number]> = {
  PATIENT_NOT_FOUND: ["Patient was not found in this facility.", 404],
  PRESCRIPTION_NOT_FOUND: ["Prescription was not found in this facility.", 404],
  PRESCRIPTION_LOCKED: ["This prescription can no longer be changed.", 409],
  PRESCRIPTION_ALREADY_FULFILLED: [
    "This prescription has no remaining medicine to release externally.",
    409,
  ],
  CANCELLATION_REASON_REQUIRED: ["A cancellation reason is required.", 400],
  MEDICATION_NOT_FOUND: ["Medication was not found in this facility.", 404],
  STOCK_NOT_FOUND: ["Stock batch was not found in this facility.", 404],
  STOCK_EXPIRED: ["Expired medicine cannot be dispensed.", 409],
  STOCK_NOT_EXPIRED: [
    "Only an expired batch can use the expired-stock workflow.",
    409,
  ],
  INSUFFICIENT_STOCK: ["The selected batch does not have enough stock.", 409],
  INVALID_QUANTITY: ["Quantity must be greater than zero.", 400],
  INVALID_DISPENSE_ITEM: [
    "A dispensing item does not match this prescription.",
    400,
  ],
  PARTIAL_REASON_REQUIRED: ["A partial dispensing reason is required.", 400],
  SAFETY_OVERRIDE_REQUIRED: [
    "Document and acknowledge the clinical safety warning before dispensing.",
    409,
  ],
  DISPENSING_NOT_FOUND: ["Dispensing record was not found.", 404],
  DISPENSING_LOCKED: ["Released dispensing records are immutable.", 409],
  MOVEMENT_NOT_ALLOWED: [
    "That stock movement must use its dedicated workflow.",
    400,
  ],
  MOVEMENT_NOT_FOUND: ["Stock movement was not found.", 404],
  MOVEMENT_ALREADY_REVERSED: [
    "This stock movement has already been reversed.",
    409,
  ],
  REORDER_NOT_FOUND: ["Reorder request was not found.", 404],
  REORDER_TRANSITION_INVALID: [
    "That reorder status transition is not allowed.",
    409,
  ],
  NOTIFICATION_NOT_FOUND: ["Notification was not found.", 404],
}

export function pharmacyError(error: unknown) {
  const key = error instanceof Error ? error.message : "PHARMACY_FAILED"
  const known = pharmacyErrors[key]
  return Response.json(
    {
      success: false,
      message:
        known?.[0] ??
        (error instanceof Error ? error.message : "Pharmacy action failed."),
    },
    { status: known?.[1] ?? 500 }
  )
}

export function parsePharmacyPagination(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page")) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(params.get("pageSize")) || 25)
  )
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export function pharmacyPage<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PharmacyPage<T> {
  return { items, total, page, pageSize }
}

export function prescriptionScope(
  facilityId: string
): Prisma.PrescriptionWhereInput {
  return {
    patient: { registeredFacilityId: facilityId },
    AND: [{ OR: [{ encounterId: null }, { encounter: { facilityId } }] }],
  }
}

export async function ensurePharmacyPrescription(
  id: string,
  facilityId: string,
  client: DbClient = prisma
) {
  return client.prescription.findFirst({
    where: { id, ...prescriptionScope(facilityId) },
    include: pharmacyPrescriptionInclude,
  })
}

export async function ensurePharmacyStock(
  id: string,
  facilityId: string,
  client: DbClient = prisma
) {
  return client.medicationStock.findFirst({
    where: { id, facilityId, medication: { facilityId } },
    include: pharmacyStockInclude,
  })
}

export function fullName(person: {
  firstName: string
  lastName: string
  otherNames?: string | null
}) {
  return [person.firstName, person.otherNames, person.lastName]
    .filter(Boolean)
    .join(" ")
}
export function decimal(
  value: { toString(): string } | number | null | undefined
) {
  return value === null || value === undefined ? null : Number(value.toString())
}
export function normalizeMedicine(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
export function isExpired(expiryDate: Date | null, at = new Date()) {
  return Boolean(
    expiryDate &&
    expiryDate.getTime() <
      new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()
  )
}
export function isExpiringSoon(expiryDate: Date | null, at = new Date()) {
  return Boolean(
    expiryDate &&
    !isExpired(expiryDate, at) &&
    expiryDate.getTime() <= at.getTime() + 30 * 86400000
  )
}
export function canTransitionReorder(current: string, next: string) {
  if (current === next) return true
  return current === "REQUESTED"
    ? ["ORDERED", "CANCELLED"].includes(next)
    : current === "ORDERED"
      ? ["RECEIVED", "CANCELLED"].includes(next)
      : false
}

export function serializeMedication(medication: {
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
  stocks?: { quantityOnHand: number }[]
}): MedicationCatalogItem {
  return {
    id: medication.id,
    code: medication.code,
    name: medication.name,
    genericName: medication.genericName,
    category: medication.category,
    dosageForm: medication.dosageForm,
    strength: medication.strength,
    unit: medication.unit,
    reorderLevel: medication.reorderLevel,
    isActive: medication.isActive,
    stockQuantity:
      medication.stocks?.reduce(
        (sum, stock) => sum + stock.quantityOnHand,
        0
      ) ?? 0,
  }
}

export function serializeStock(stock: StockRecord): MedicationStockItem {
  const stockStatus = isExpired(stock.expiryDate)
    ? "EXPIRED"
    : stock.quantityOnHand <= 0
      ? "OUT"
      : stock.quantityOnHand <= stock.medication.reorderLevel
        ? "LOW"
        : "AVAILABLE"
  return {
    id: stock.id,
    medicationId: stock.medicationId,
    medicationName: stock.medication.name,
    genericName: stock.medication.genericName,
    category: stock.medication.category,
    batchNumber: stock.batchNumber,
    expiryDate: stock.expiryDate?.toISOString() ?? null,
    quantityOnHand: stock.quantityOnHand,
    reorderLevel: stock.medication.reorderLevel,
    unitCost: decimal(stock.unitCost),
    sellingPrice: decimal(stock.sellingPrice),
    stockStatus,
  }
}

export function serializeDispensing(
  record: DispensingRecord
): DispensingListItem {
  return {
    id: record.id,
    dispenseNo: record.dispenseNo,
    prescriptionId: record.prescriptionId,
    prescriptionNo: record.prescription.prescriptionNo,
    patientId: record.patientId,
    patientName: fullName(record.patient),
    status: record.status,
    dispensedByName: record.dispensedBy?.name ?? null,
    dispensedAt: record.dispensedAt?.toISOString() ?? null,
    itemCount: record.items.length,
  }
}

function queueItem(record: PrescriptionRecord): PrescriptionQueueItem {
  return {
    id: record.id,
    prescriptionNo: record.prescriptionNo,
    patientId: record.patientId,
    patientName: fullName(record.patient),
    patientNo: record.patient.patientNo,
    prescribedByName: record.prescribedBy?.name ?? null,
    medicationCount: record.items.length,
    status: record.status,
    issuedAt: record.issuedAt?.toISOString() ?? null,
    billingStatus: record.encounter?.invoices[0]?.status ?? null,
  }
}

export const serializePrescriptionQueueItem = queueItem

export async function serializePrescriptionDetail(
  record: PrescriptionRecord,
  client: DbClient = prisma
): Promise<PrescriptionDetail> {
  const medicationIds = record.items.flatMap((item) =>
    item.medicationId ? [item.medicationId] : []
  )
  const [stocks, otherPrescriptions] = await Promise.all([
    client.medicationStock.findMany({
      where: {
        facilityId: record.patient.registeredFacilityId,
        medicationId: { in: medicationIds },
        quantityOnHand: { gt: 0 },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    }),
    client.prescription.findMany({
      where: {
        patientId: record.patientId,
        id: { not: record.id },
        status: { in: ["ISSUED", "PARTIALLY_DISPENSED"] },
      },
      include: { items: true },
    }),
  ])
  const dispensedByItem = new Map<string, number>()
  for (const dispensing of record.dispensings)
    for (const item of dispensing.items)
      if (item.prescriptionItemId)
        dispensedByItem.set(
          item.prescriptionItemId,
          (dispensedByItem.get(item.prescriptionItemId) ?? 0) +
            item.quantityDispensed
        )
  const warnings: PharmacySafetyWarning[] = []
  for (const item of record.items) {
    const names = [
      item.medicineName,
      item.medication?.name,
      item.medication?.genericName,
    ]
      .filter(Boolean)
      .map((value) => normalizeMedicine(String(value)))
    for (const allergy of record.patient.allergies) {
      const allergen = normalizeMedicine(allergy.allergen)
      if (
        allergen &&
        names.some((name) => name.includes(allergen) || allergen.includes(name))
      )
        warnings.push({
          type: "ALLERGY",
          level: "warning",
          prescriptionItemId: item.id,
          medicationId: item.medicationId,
          message: `${item.medicineName} matches documented allergy ${allergy.allergen}${allergy.severity ? ` (${allergy.severity})` : ""}.`,
          requiresReason: true,
        })
    }
    const duplicate =
      record.patient.medicationHistory.some(
        (history) =>
          (!history.endDate || history.endDate >= new Date()) &&
          names.some(
            (name) =>
              name.includes(normalizeMedicine(history.medicationName)) ||
              normalizeMedicine(history.medicationName).includes(name)
          )
      ) ||
      otherPrescriptions.some((rx) =>
        rx.items.some(
          (other) =>
            (item.medicationId && other.medicationId === item.medicationId) ||
            normalizeMedicine(other.medicineName) ===
              normalizeMedicine(item.medicineName)
        )
      )
    if (duplicate)
      warnings.push({
        type: "DUPLICATE_MEDICATION",
        level: "warning",
        prescriptionItemId: item.id,
        medicationId: item.medicationId,
        message: `${item.medicineName} also appears in the patient’s active medication history.`,
        requiresReason: true,
      })
  }
  return {
    ...queueItem(record),
    notes: record.notes,
    patient: {
      id: record.patient.id,
      patientNo: record.patient.patientNo,
      name: fullName(record.patient),
      gender: record.patient.gender,
      allergies: record.patient.allergies.map((item) => ({
        allergen: item.allergen,
        severity: item.severity,
        reaction: item.reaction,
      })),
      chronicConditions: record.patient.chronicConditions.map((item) => ({
        name: item.name,
        status: item.status,
      })),
      medicationHistory: record.patient.medicationHistory.map((item) => ({
        medicationName: item.medicationName,
        dosage: item.dosage,
        frequency: item.frequency,
        startDate: item.startDate?.toISOString() ?? null,
        endDate: item.endDate?.toISOString() ?? null,
      })),
    },
    encounter: record.encounter
      ? {
          id: record.encounter.id,
          encounterNo: record.encounter.encounterNo,
          chiefComplaint: record.encounter.chiefComplaint,
          departmentName: record.encounter.department.name,
          diagnoses: record.encounter.diagnoses.map((item) => item.name),
        }
      : null,
    items: record.items.map((item) => {
      const dispensedQuantity = dispensedByItem.get(item.id) ?? 0
      const unresolvedQuantity = Math.max(
        0,
        (item.quantity ?? 0) - dispensedQuantity
      )
      const externallyReleasedQuantity =
        record.status === "EXTERNALLY_RELEASED" ? unresolvedQuantity : 0
      return {
        id: item.id,
        medicationId: item.medicationId,
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions,
        dispensedQuantity,
        externallyReleasedQuantity,
        remainingQuantity: Math.max(
          0,
          unresolvedQuantity - externallyReleasedQuantity
        ),
        batches: stocks
          .filter((stock) => stock.medicationId === item.medicationId)
          .map((stock) => ({
            id: stock.id,
            batchNumber: stock.batchNumber,
            expiryDate: stock.expiryDate?.toISOString() ?? null,
            quantityOnHand: stock.quantityOnHand,
            sellingPrice: decimal(stock.sellingPrice),
          })),
      }
    }),
    warnings,
    dispensings: record.dispensings.map((item) =>
      serializeDispensing(item as DispensingRecord)
    ),
    cancellationReason: record.cancellationReason,
    externalReleaseReason: record.externalReleaseReason,
    externallyReleasedAt: record.externallyReleasedAt?.toISOString() ?? null,
    externallyReleasedByName: record.externallyReleasedBy?.name ?? null,
    timeline: [
      {
        label: "Prescription created",
        at: record.createdAt.toISOString(),
        detail: record.prescribedBy?.name,
        tone: "blue",
      },
      ...(record.issuedAt
        ? [
            {
              label: "Prescription issued",
              at: record.issuedAt.toISOString(),
              tone: "orange",
            },
          ]
        : []),
      ...record.dispensings.map((item) => ({
        label:
          item.status === "COMPLETED" ? "Dispensed" : "Partially dispensed",
        at: (item.dispensedAt ?? item.createdAt).toISOString(),
        detail: item.dispensedBy?.name,
        tone: item.status === "COMPLETED" ? "green" : "orange",
      })),
      ...(record.externallyReleasedAt
        ? [
            {
              label: "Remaining prescription released for external purchase",
              at: record.externallyReleasedAt.toISOString(),
              detail: record.externalReleaseReason,
              tone: "blue",
            },
          ]
        : []),
      ...(record.cancelledAt
        ? [
            {
              label: "Prescription cancelled",
              at: record.cancelledAt.toISOString(),
              detail: record.cancellationReason,
              tone: "red",
            },
          ]
        : []),
    ].sort((a, b) => a.at.localeCompare(b.at)),
  }
}

export function generateDispenseNo() {
  return `DSP-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}
export function generateReorderReference() {
  return `REQ-${new Date().toISOString().replace(/\D/g, "").slice(0, 8)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

export function auditMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  }
}
export async function writePharmacyAuditLog({
  client = prisma,
  request,
  actor,
  action,
  entityType,
  entityId,
  description,
  before,
  after,
}: {
  client?: DbClient
  request: NextRequest
  actor: Pick<AuthenticatedStaff, "id">
  action: AuditAction
  entityType: string
  entityId?: string | null
  description: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}) {
  const meta = auditMeta(request)
  return client.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entityType,
      entityId,
      description,
      before,
      after,
      ...meta,
    },
  })
}

export async function reconcileLowStockNotification(
  client: DbClient,
  stock: {
    id: string
    facilityId: string
    quantityOnHand: number
    medication: { name: string; reorderLevel: number }
  },
  actorId?: string
) {
  const where = {
    facilityId: stock.facilityId,
    type: NotificationType.STOCK,
    entityType: "MedicationStock",
    entityId: stock.id,
    status: NotificationStatus.UNREAD,
  } as const
  if (stock.quantityOnHand <= stock.medication.reorderLevel) {
    const existing = await client.notification.findFirst({ where })
    if (!existing)
      await client.notification.create({
        data: {
          facilityId: stock.facilityId,
          createdById: actorId,
          targetRole: StaffRole.PHARMACIST,
          type: NotificationType.STOCK,
          priority: stock.quantityOnHand <= 0 ? "URGENT" : "HIGH",
          title: `Low stock: ${stock.medication.name}`,
          body: `${stock.quantityOnHand} remaining; reorder level ${stock.medication.reorderLevel}.`,
          actionUrl: "/pharmacy/low-stock",
          entityType: "MedicationStock",
          entityId: stock.id,
        },
      })
  } else
    await client.notification.updateMany({
      where,
      data: { status: NotificationStatus.ARCHIVED },
    })
}

export function serializeMovement(movement: {
  id: string
  stockId: string
  medicationId: string
  type: StockMovementItem["type"]
  quantity: number
  reason: string | null
  reference: string | null
  reversalOfId: string | null
  createdAt: Date
  medication: { name: string }
  stock: { batchNumber: string | null }
  performedBy: { name: string } | null
}): StockMovementItem {
  return {
    id: movement.id,
    stockId: movement.stockId,
    medicationId: movement.medicationId,
    medicationName: movement.medication.name,
    batchNumber: movement.stock.batchNumber,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    reference: movement.reference,
    performedByName: movement.performedBy?.name ?? null,
    reversalOfId: movement.reversalOfId,
    createdAt: movement.createdAt.toISOString(),
  }
}
export function serializePharmacyNotification(notification: {
  id: string
  type: NotificationType
  status: NotificationStatus
  priority: string
  title: string
  body: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  readAt: Date | null
  createdAt: Date
}): PharmacyNotificationItem {
  return {
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }
}
