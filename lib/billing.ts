import type { NextRequest } from "next/server"

import type { AuthenticatedStaff } from "@/lib/auth-session"
import { requireRoleApi } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  AuditAction,
  InvoiceStatus,
  NotificationStatus,
  PaymentMethod,
  PaymentStatus,
  StaffRole,
} from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import type {
  BillingNotificationItem,
  BillingPage,
  InvoiceDetail,
  InvoiceItemPayload,
  InvoiceListItem,
  PatientBillingListItem,
  PaymentListItem,
  PendingCharge,
} from "@/types/billing"

type DbClient = Prisma.TransactionClient | typeof prisma

export class BillingError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message)
  }
}

export const billingInvoiceInclude = {
  patient: true,
  encounter: { include: { department: true } },
  createdBy: true,
  cancelledBy: true,
  voidedBy: true,
  items: { orderBy: { createdAt: "asc" as const } },
  payments: {
    include: { receivedBy: true, approvedBy: true, reversedBy: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.InvoiceInclude

export const billingPaymentInclude = {
  receivedBy: true,
  approvedBy: true,
  reversedBy: true,
  invoice: {
    include: {
      patient: true,
      encounter: { include: { department: true } },
      createdBy: true,
    },
  },
} satisfies Prisma.PaymentInclude

type InvoiceRecord = Prisma.InvoiceGetPayload<{
  include: typeof billingInvoiceInclude
}>
type PaymentRecord = Prisma.PaymentGetPayload<{
  include: typeof billingPaymentInclude
}>

export async function requireBillingApi(request: NextRequest) {
  const result = await requireRoleApi(request, [StaffRole.BILLING_OFFICER])
  if (result.response) return result
  if (!result.staff?.facilityId) {
    return {
      staff: result.staff,
      response: Response.json(
        {
          success: false,
          message: "Billing Officer is not assigned to a facility.",
          code: "FACILITY_REQUIRED",
        },
        { status: 403 }
      ),
    }
  }
  return result
}

export async function withBilling(
  request: NextRequest,
  handler: (actor: AuthenticatedStaff) => Promise<Response>
) {
  const { staff, response } = await requireBillingApi(request)
  if (response) return response
  try {
    return await handler(staff!)
  } catch (error) {
    if (error instanceof BillingError) {
      return Response.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      )
    }
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          success: false,
          message:
            "This service has already been billed or the generated number already exists.",
          code: "DUPLICATE_BILLING_REFERENCE",
        },
        { status: 409 }
      )
    }
    console.error("Billing request failed", error)
    return Response.json(
      {
        success: false,
        message: "The billing request could not be completed.",
        code: "BILLING_REQUEST_FAILED",
      },
      { status: 500 }
    )
  }
}

export function billingOk<T>(data: T, message?: string, status = 200) {
  return Response.json({ success: true, data, message }, { status })
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

export function decimal(value: unknown) {
  if (value === null || value === undefined) return 0
  return Number(String(value))
}

export function toPesewas(value: unknown) {
  const amount = decimal(value)
  if (!Number.isFinite(amount)) {
    throw new BillingError("A monetary value is invalid.", "INVALID_MONEY")
  }
  return Math.round(amount * 100)
}

export function fromPesewas(value: number) {
  return Number((value / 100).toFixed(2))
}

export function calculateInvoiceTotals(
  items: InvoiceItemPayload[],
  discountAmount = 0,
  taxAmount = 0
) {
  const normalizedItems = items.map((item) => {
    const totalPesewas = toPesewas(item.unitPrice) * item.quantity
    return { ...item, totalPrice: fromPesewas(totalPesewas) }
  })
  const subtotalPesewas = normalizedItems.reduce(
    (sum, item) => sum + toPesewas(item.totalPrice),
    0
  )
  const discountPesewas = toPesewas(discountAmount)
  const taxPesewas = toPesewas(taxAmount)
  if (discountPesewas > subtotalPesewas) {
    throw new BillingError(
      "Discount cannot exceed the invoice subtotal.",
      "INVALID_DISCOUNT"
    )
  }
  const totalPesewas = subtotalPesewas - discountPesewas + taxPesewas
  if (totalPesewas <= 0) {
    throw new BillingError(
      "Invoice total must be greater than GH₵0.00.",
      "INVALID_INVOICE_TOTAL"
    )
  }
  return {
    items: normalizedItems,
    subtotal: fromPesewas(subtotalPesewas),
    discountAmount: fromPesewas(discountPesewas),
    taxAmount: fromPesewas(taxPesewas),
    totalAmount: fromPesewas(totalPesewas),
  }
}

export function formatGhs(value: unknown) {
  return `GH₵ ${decimal(value).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize")) || 25)
  )
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export function pageData<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): BillingPage<T> {
  return { items, total, page, pageSize }
}

export function dateRange(
  searchParams: URLSearchParams,
  field: string,
  defaults?: { from?: Date; to?: Date }
) {
  const from = searchParams.get("dateFrom")
  const to = searchParams.get("dateTo")
  if (!from && !to && !defaults?.from && !defaults?.to) return {}
  return {
    [field]: {
      ...(from
        ? { gte: new Date(`${from}T00:00:00.000Z`) }
        : defaults?.from
          ? { gte: defaults.from }
          : {}),
      ...(to
        ? { lte: new Date(`${to}T23:59:59.999Z`) }
        : defaults?.to
          ? { lte: defaults.to }
          : {}),
    },
  }
}

function timestampPart() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14)
}

export function generateInvoiceNo(prefix = "INV-SDA") {
  return `${prefix}-${timestampPart()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

export function generateReceiptNo(prefix = "RCT-SDA") {
  return `${prefix}-${timestampPart()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

export async function getInvoicePrefix(client: DbClient = prisma) {
  const setting = await client.systemSetting.findUnique({
    where: { key: "invoice.numberPrefix" },
    select: { value: true },
  })
  return typeof setting?.value === "string" ? setting.value : "INV-SDA"
}

export function invoiceScope(facilityId: string): Prisma.InvoiceWhereInput {
  return { facilityId, patient: { registeredFacilityId: facilityId } }
}

export async function ensureBillingPatient(
  patientId: string,
  facilityId: string,
  client: DbClient = prisma
) {
  const patient = await client.patient.findFirst({
    where: { id: patientId, registeredFacilityId: facilityId },
  })
  if (!patient) {
    throw new BillingError(
      "Patient was not found in your facility.",
      "PATIENT_NOT_FOUND",
      404
    )
  }
  return patient
}

export async function ensureBillingEncounter(
  encounterId: string,
  patientId: string,
  facilityId: string,
  client: DbClient = prisma
) {
  const encounter = await client.encounter.findFirst({
    where: { id: encounterId, patientId, facilityId },
    include: { department: true },
  })
  if (!encounter) {
    throw new BillingError(
      "Encounter was not found for this patient and facility.",
      "ENCOUNTER_NOT_FOUND",
      404
    )
  }
  return encounter
}

export async function ensureBillingInvoice(
  invoiceId: string,
  facilityId: string,
  client: DbClient = prisma
) {
  const invoice = await client.invoice.findFirst({
    where: { id: invoiceId, ...invoiceScope(facilityId) },
    include: billingInvoiceInclude,
  })
  if (!invoice) {
    throw new BillingError(
      "Invoice was not found in your facility.",
      "INVOICE_NOT_FOUND",
      404
    )
  }
  return invoice
}

export async function ensureBillingPayment(
  paymentId: string,
  facilityId: string,
  client: DbClient = prisma
) {
  const payment = await client.payment.findFirst({
    where: { id: paymentId, invoice: invoiceScope(facilityId) },
    include: billingPaymentInclude,
  })
  if (!payment) {
    throw new BillingError(
      "Payment was not found in your facility.",
      "PAYMENT_NOT_FOUND",
      404
    )
  }
  return payment
}

export async function validateInvoiceSources(
  items: InvoiceItemPayload[],
  facilityId: string,
  patientId: string,
  client: DbClient = prisma,
  excludeInvoiceId?: string
) {
  const keys = items.flatMap((item) => (item.sourceKey ? [item.sourceKey] : []))
  if (new Set(keys).size !== keys.length) {
    throw new BillingError(
      "The same service cannot appear twice on an invoice.",
      "DUPLICATE_SERVICE"
    )
  }
  if (keys.length) {
    const duplicate = await client.invoiceItem.findFirst({
      where: {
        sourceKey: { in: keys },
        ...(excludeInvoiceId ? { invoiceId: { not: excludeInvoiceId } } : {}),
      },
      select: { sourceKey: true },
    })
    if (duplicate) {
      throw new BillingError(
        `Service ${duplicate.sourceKey} has already been billed.`,
        "DUPLICATE_SERVICE",
        409
      )
    }
  }

  for (const item of items) {
    if (!item.sourceKey) continue
    const [kind, referenceId] = item.sourceKey.split(":", 2)
    if (!referenceId || referenceId !== item.referenceId) {
      throw new BillingError(
        "A service reference is invalid.",
        "INVALID_SERVICE_REFERENCE"
      )
    }
    let valid = false
    if (kind === "PATIENT") {
      valid =
        referenceId === patientId &&
        Boolean(
          await client.patient.findFirst({
            where: { id: referenceId, registeredFacilityId: facilityId },
            select: { id: true },
          })
        )
    } else if (kind === "APPOINTMENT") {
      valid = Boolean(
        await client.appointment.findFirst({
          where: { id: referenceId, patientId, facilityId },
          select: { id: true },
        })
      )
    } else if (kind === "ENCOUNTER") {
      valid = Boolean(
        await client.encounter.findFirst({
          where: { id: referenceId, patientId, facilityId },
          select: { id: true },
        })
      )
    } else if (kind === "LAB_TEST") {
      valid = Boolean(
        await client.labRequestTest.findFirst({
          where: {
            id: referenceId,
            labRequest: {
              patientId,
              OR: [{ encounterId: null }, { encounter: { facilityId } }],
            },
            test: { facilityId },
          },
          select: { id: true },
        })
      )
    } else if (kind === "PRESCRIPTION_ITEM") {
      valid = Boolean(
        await client.prescriptionItem.findFirst({
          where: {
            id: referenceId,
            prescription: { patientId, status: { not: "CANCELLED" } },
            OR: [{ medicationId: null }, { medication: { facilityId } }],
          },
          select: { id: true },
        })
      )
    } else if (kind === "DISPENSE_ITEM") {
      valid = Boolean(
        await client.dispenseItem.findFirst({
          where: {
            id: referenceId,
            dispensing: { patientId, status: { not: "CANCELLED" } },
            OR: [{ stockId: null }, { stock: { facilityId } }],
          },
          select: { id: true },
        })
      )
    }
    if (!valid) {
      throw new BillingError(
        `Service reference ${item.sourceKey} is invalid for this patient.`,
        "INVALID_SERVICE_REFERENCE"
      )
    }
  }
}

export function getRequestAuditMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  }
}

export async function writeBillingAuditLog({
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
  const meta = getRequestAuditMeta(request)
  return client.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entityType,
      entityId,
      description,
      before,
      after,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  })
}

export async function notifyBillingService(
  client: DbClient,
  input: {
    facilityId: string
    createdById: string
    entityType: string
    entityId: string
    title: string
    body?: string | null
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  }
) {
  const existing = await client.notification.findFirst({
    where: {
      facilityId: input.facilityId,
      targetRole: "BILLING_OFFICER",
      type: "BILLING",
      entityType: input.entityType,
      entityId: input.entityId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  })
  if (existing) return existing
  return client.notification.create({
    data: {
      facilityId: input.facilityId,
      createdById: input.createdById,
      targetRole: "BILLING_OFFICER",
      type: "BILLING",
      priority: input.priority ?? "NORMAL",
      title: input.title,
      body: input.body,
      actionUrl: "/billing/patients",
      entityType: input.entityType,
      entityId: input.entityId,
    },
  })
}

function baseInvoice(invoice: InvoiceRecord): InvoiceListItem {
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    patientId: invoice.patientId,
    patientName: fullName(invoice.patient),
    patientNo: invoice.patient.patientNo,
    encounterId: invoice.encounterId,
    encounterNo: invoice.encounter?.encounterNo ?? null,
    departmentName: invoice.encounter?.department.name ?? null,
    totalAmount: decimal(invoice.totalAmount),
    amountPaid: decimal(invoice.amountPaid),
    balanceDue: decimal(invoice.balanceDue),
    status: invoice.status,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    createdByName: invoice.createdBy?.name ?? null,
  }
}

export function serializeInvoiceList(invoice: InvoiceRecord): InvoiceListItem {
  return baseInvoice(invoice)
}

function paymentBase(
  payment: {
    id: string
    receiptNo: string
    invoiceId: string
    method: PaymentMethod
    status: PaymentStatus
    amount: unknown
    reference: string | null
    notes: string | null
    approvalReference: string | null
    approvedBy: { name: string } | null
    receivedBy: { name: string } | null
    paidAt: Date | null
    reversedAt: Date | null
    reversedBy: { name: string } | null
    reversalReason: string | null
    reversalReference: string | null
  },
  invoice: {
    invoiceNo: string
    patientId: string
    patient: {
      patientNo: string
      firstName: string
      lastName: string
      otherNames: string | null
    }
  }
): PaymentListItem {
  return {
    id: payment.id,
    receiptNo: payment.receiptNo,
    invoiceId: payment.invoiceId,
    invoiceNo: invoice.invoiceNo,
    patientId: invoice.patientId,
    patientName: fullName(invoice.patient),
    patientNo: invoice.patient.patientNo,
    method: payment.method,
    status: payment.status,
    amount: decimal(payment.amount),
    reference: payment.reference,
    notes: payment.notes,
    approvalReference: payment.approvalReference,
    approvedByName: payment.approvedBy?.name ?? null,
    receivedByName: payment.receivedBy?.name ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    reversedAt: payment.reversedAt?.toISOString() ?? null,
    reversedByName: payment.reversedBy?.name ?? null,
    reversalReason: payment.reversalReason,
    reversalReference: payment.reversalReference,
  }
}

export function serializePayment(payment: PaymentRecord): PaymentListItem {
  return paymentBase(payment, payment.invoice)
}

export function serializeInvoice(invoice: InvoiceRecord): InvoiceDetail {
  const base = baseInvoice(invoice)
  return {
    ...base,
    patient: {
      id: invoice.patient.id,
      patientNo: invoice.patient.patientNo,
      name: fullName(invoice.patient),
      phone: invoice.patient.phone,
      nhisNumber: invoice.patient.nhisNumber,
    },
    subtotal: decimal(invoice.subtotal),
    discountAmount: decimal(invoice.discountAmount),
    taxAmount: decimal(invoice.taxAmount),
    notes: invoice.notes,
    cancellationReason: invoice.cancellationReason,
    cancelledAt: invoice.cancelledAt?.toISOString() ?? null,
    cancelledByName: invoice.cancelledBy?.name ?? null,
    voidReason: invoice.voidReason,
    voidedAt: invoice.voidedAt?.toISOString() ?? null,
    voidedByName: invoice.voidedBy?.name ?? null,
    replacementInvoiceId: invoice.replacementInvoiceId,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      itemType: item.itemType ?? "OTHER",
      quantity: item.quantity,
      unitPrice: decimal(item.unitPrice),
      totalPrice: decimal(item.totalPrice),
      referenceId: item.referenceId,
      sourceKey: item.sourceKey,
    })),
    payments: invoice.payments.map((payment) => paymentBase(payment, invoice)),
  }
}

export async function serializePatientListItem(patient: {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  otherNames: string | null
  phone: string | null
  nhisNumber: string | null
  invoices: Array<{
    status: InvoiceStatus
    balanceDue: unknown
    payments: Array<{ paidAt: Date | null }>
  }>
}): Promise<PatientBillingListItem> {
  const active = patient.invoices.filter(
    (item) =>
      item.status === InvoiceStatus.ISSUED ||
      item.status === InvoiceStatus.PARTIALLY_PAID
  )
  const outstandingBalance = active.reduce(
    (sum, item) => sum + decimal(item.balanceDue),
    0
  )
  const lastPayment = patient.invoices
    .flatMap((invoice) => invoice.payments)
    .map((payment) => payment.paidAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0]
  return {
    id: patient.id,
    patientNo: patient.patientNo,
    name: fullName(patient),
    phone: patient.phone,
    nhisNumber: patient.nhisNumber,
    activeInvoiceCount: active.length,
    outstandingBalance,
    lastPaymentAt: lastPayment?.toISOString() ?? null,
    billingStatus:
      outstandingBalance > 0
        ? "OUTSTANDING"
        : patient.invoices.length
          ? "CLEAR"
          : "NO_INVOICE",
  }
}

export async function getPendingCharges(
  patientId: string,
  facilityId: string,
  client: DbClient = prisma
): Promise<PendingCharge[]> {
  await ensureBillingPatient(patientId, facilityId, client)
  const billed = await client.invoiceItem.findMany({
    where: {
      sourceKey: { not: null },
      invoice: {
        patientId,
        facilityId,
        status: { notIn: ["CANCELLED", "VOID"] },
      },
    },
    select: { sourceKey: true },
  })
  const billedKeys = new Set(
    billed.flatMap((item) => (item.sourceKey ? [item.sourceKey] : []))
  )
  const [
    patient,
    appointments,
    encounters,
    labTests,
    prescriptionItems,
    dispenseItems,
  ] = await Promise.all([
    client.patient.findUniqueOrThrow({ where: { id: patientId } }),
    client.appointment.findMany({
      where: {
        patientId,
        facilityId,
        status: { notIn: ["CANCELLED", "MISSED"] },
      },
      include: { department: true },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
    client.encounter.findMany({
      where: { patientId, facilityId, status: { not: "CANCELLED" } },
      include: { department: true },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    client.labRequestTest.findMany({
      where: {
        labRequest: {
          patientId,
          status: { not: "CANCELLED" },
          OR: [{ encounterId: null }, { encounter: { facilityId } }],
        },
        test: { facilityId },
      },
      include: { test: true, labRequest: true },
      orderBy: { createdAt: "desc" },
    }),
    client.prescriptionItem.findMany({
      where: {
        prescription: { patientId, status: { notIn: ["DRAFT", "CANCELLED"] } },
        OR: [{ medicationId: null }, { medication: { facilityId } }],
      },
      include: {
        prescription: true,
        dispenseItems: true,
        medication: {
          include: {
            stocks: {
              where: { facilityId },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    client.dispenseItem.findMany({
      where: {
        dispensing: { patientId, status: { not: "CANCELLED" } },
        OR: [{ stockId: null }, { stock: { facilityId } }],
      },
      include: { dispensing: true, stock: true, prescriptionItem: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const charges: PendingCharge[] = []
  const push = (charge: PendingCharge) => {
    if (!billedKeys.has(charge.sourceKey)) charges.push(charge)
  }
  push({
    sourceKey: `PATIENT:${patient.id}`,
    referenceId: patient.id,
    description: "Patient registration",
    itemType: "REGISTRATION",
    quantity: 1,
    unitPrice: null,
    totalPrice: null,
    sourceLabel: patient.patientNo,
    occurredAt: patient.createdAt.toISOString(),
    requiresPrice: true,
  })
  for (const item of appointments) {
    push({
      sourceKey: `APPOINTMENT:${item.id}`,
      referenceId: item.id,
      description: item.title || "Appointment service",
      itemType: "APPOINTMENT",
      quantity: 1,
      unitPrice: null,
      totalPrice: null,
      sourceLabel: item.appointmentNo,
      occurredAt: item.scheduledAt.toISOString(),
      requiresPrice: true,
    })
  }
  for (const item of encounters) {
    push({
      sourceKey: `ENCOUNTER:${item.id}`,
      referenceId: item.id,
      description: `${item.department.name} consultation`,
      itemType: "CONSULTATION",
      quantity: 1,
      unitPrice: null,
      totalPrice: null,
      sourceLabel: item.encounterNo,
      occurredAt: item.startedAt.toISOString(),
      requiresPrice: true,
    })
  }
  for (const item of labTests) {
    const price = item.test.price === null ? null : decimal(item.test.price)
    push({
      sourceKey: `LAB_TEST:${item.id}`,
      referenceId: item.id,
      description: item.test.name,
      itemType: "LABORATORY",
      quantity: 1,
      unitPrice: price,
      totalPrice: price,
      sourceLabel: item.labRequest.requestNo,
      occurredAt: item.createdAt.toISOString(),
      requiresPrice: price === null,
    })
  }
  for (const item of prescriptionItems) {
    if (item.dispenseItems.length) continue
    const stockPrice = item.medication?.stocks.find(
      (stock) => stock.sellingPrice !== null
    )?.sellingPrice
    const price =
      stockPrice === null || stockPrice === undefined
        ? null
        : decimal(stockPrice)
    const quantity = item.quantity ?? 1
    push({
      sourceKey: `PRESCRIPTION_ITEM:${item.id}`,
      referenceId: item.id,
      description: item.medicineName,
      itemType: "MEDICATION",
      quantity,
      unitPrice: price,
      totalPrice:
        price === null ? null : fromPesewas(toPesewas(price) * quantity),
      sourceLabel: item.prescription.prescriptionNo,
      occurredAt: item.createdAt.toISOString(),
      requiresPrice: price === null,
    })
  }
  for (const item of dispenseItems) {
    const price =
      item.stock?.sellingPrice === null ||
      item.stock?.sellingPrice === undefined
        ? null
        : decimal(item.stock.sellingPrice)
    push({
      sourceKey: `DISPENSE_ITEM:${item.id}`,
      referenceId: item.id,
      description: item.medicineName,
      itemType: "MEDICATION",
      quantity: item.quantityDispensed,
      unitPrice: price,
      totalPrice:
        price === null
          ? null
          : fromPesewas(toPesewas(price) * item.quantityDispensed),
      sourceLabel: item.dispensing.dispenseNo,
      occurredAt: item.createdAt.toISOString(),
      requiresPrice: price === null,
    })
  }
  return charges.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

export async function recalculateInvoiceAfterPayments(
  client: Prisma.TransactionClient,
  invoiceId: string
) {
  const invoice = await client.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  })
  const aggregate = await client.payment.aggregate({
    where: { invoiceId, status: PaymentStatus.SUCCESSFUL },
    _sum: { amount: true },
  })
  const paidPesewas = toPesewas(aggregate._sum.amount)
  const totalPesewas = toPesewas(invoice.totalAmount)
  const balancePesewas = Math.max(0, totalPesewas - paidPesewas)
  const status =
    paidPesewas <= 0
      ? InvoiceStatus.ISSUED
      : balancePesewas > 0
        ? InvoiceStatus.PARTIALLY_PAID
        : InvoiceStatus.PAID
  return client.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: fromPesewas(paidPesewas),
      balanceDue: fromPesewas(balancePesewas),
      status,
    },
    include: billingInvoiceInclude,
  })
}

export function billingNotificationWhere(
  actor: Pick<
    AuthenticatedStaff,
    "id" | "facilityId" | "defaultRole" | "departmentId"
  >
): Prisma.NotificationWhereInput {
  return {
    type: "BILLING",
    OR: [
      { recipientId: actor.id },
      {
        facilityId: actor.facilityId,
        recipientId: null,
        targetRole: actor.defaultRole,
      },
      ...(actor.departmentId
        ? [
            {
              facilityId: actor.facilityId,
              recipientId: null,
              targetDepartmentId: actor.departmentId,
            } satisfies Prisma.NotificationWhereInput,
          ]
        : []),
    ],
  }
}

export function serializeBillingNotification(notification: {
  id: string
  status: NotificationStatus
  priority: string
  title: string
  body: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  readAt: Date | null
  createdAt: Date
}): BillingNotificationItem {
  return {
    id: notification.id,
    status: notification.status,
    priority: notification.priority,
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
    entityType: notification.entityType,
    entityId: notification.entityId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }
}

export function getBillingLookups() {
  return {
    invoiceStatuses: Object.values(InvoiceStatus),
    paymentStatuses: Object.values(PaymentStatus),
    paymentMethods: Object.values(PaymentMethod),
    notificationStatuses: Object.values(NotificationStatus),
  }
}
