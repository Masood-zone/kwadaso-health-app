import type {
  InvoiceStatus,
  NotificationStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/generated/prisma/enums"

export type BillingPage<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type BillingPatientReference = {
  id: string
  patientNo: string
  name: string
  phone: string | null
  nhisNumber: string | null
}

export type InvoiceItemPayload = {
  description: string
  itemType: string
  quantity: number
  unitPrice: number
  referenceId?: string | null
  sourceKey?: string | null
}

export type InvoiceCreatePayload = {
  patientId: string
  encounterId?: string | null
  items: InvoiceItemPayload[]
  discountAmount?: number
  taxAmount?: number
  notes?: string | null
}

export type InvoiceUpdatePayload = Partial<
  Pick<InvoiceCreatePayload, "items" | "discountAmount" | "taxAmount" | "notes">
> & {
  status?: "ISSUED" | "CANCELLED" | "VOID"
  reason?: string
  replacementInvoiceId?: string | null
}

export type PaymentCreatePayload = {
  method: PaymentMethod
  amount: number
  reference?: string | null
  paidAt?: string | null
  notes?: string | null
  approvalReference?: string | null
  approvedById?: string | null
}

export type PaymentReversalPayload = {
  reason: string
  reference?: string | null
  confirmed: true
}

export type InvoiceItemDetail = InvoiceItemPayload & {
  id: string
  totalPrice: number
}

export type PaymentListItem = {
  id: string
  receiptNo: string
  invoiceId: string
  invoiceNo: string
  patientId: string
  patientName: string
  patientNo: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  reference: string | null
  notes: string | null
  approvalReference: string | null
  approvedByName: string | null
  receivedByName: string | null
  paidAt: string | null
  reversedAt: string | null
  reversedByName: string | null
  reversalReason: string | null
  reversalReference: string | null
}

export type InvoiceListItem = {
  id: string
  invoiceNo: string
  patientId: string
  patientName: string
  patientNo: string
  encounterId: string | null
  encounterNo: string | null
  departmentName: string | null
  totalAmount: number
  amountPaid: number
  balanceDue: number
  status: InvoiceStatus
  issuedAt: string | null
  createdAt: string
  createdByName: string | null
}

export type InvoiceDetail = InvoiceListItem & {
  patient: BillingPatientReference
  subtotal: number
  discountAmount: number
  taxAmount: number
  notes: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  voidReason: string | null
  voidedAt: string | null
  voidedByName: string | null
  replacementInvoiceId: string | null
  items: InvoiceItemDetail[]
  payments: PaymentListItem[]
}

export type PendingCharge = {
  sourceKey: string
  referenceId: string
  description: string
  itemType: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  sourceLabel: string
  occurredAt: string
  requiresPrice: boolean
}

export type PatientBillingListItem = BillingPatientReference & {
  activeInvoiceCount: number
  outstandingBalance: number
  lastPaymentAt: string | null
  billingStatus: "CLEAR" | "OUTSTANDING" | "NO_INVOICE"
}

export type PatientBillingSummary = {
  patient: BillingPatientReference
  activeEncounter: {
    id: string
    encounterNo: string
    status: string
    departmentName: string
    startedAt: string
  } | null
  recentAppointments: Array<{
    id: string
    appointmentNo: string
    title: string | null
    status: string
    scheduledAt: string
    departmentName: string | null
  }>
  pendingCharges: PendingCharge[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  outstandingBalance: number
  latestLabStatus: string | null
  latestDispensingStatus: string | null
}

export type BillingDashboardSummary = {
  facilityName: string
  invoicesCreatedToday: number
  amountBilledToday: number
  amountCollectedToday: number
  outstandingBalance: number
  paidInvoices: number
  partiallyPaidInvoices: number
  unpaidInvoices: number
  reversedPayments: number
  paymentMethods: Array<{ method: PaymentMethod; amount: number; count: number }>
  collectionTrend: Array<{ date: string; billed: number; collected: number }>
  recentInvoices: InvoiceListItem[]
  recentPayments: PaymentListItem[]
  alerts: Array<{ id: string; title: string; detail: string; tone: "red" | "orange" | "green" }>
}

export type OutstandingBalanceItem = InvoiceListItem & {
  invoiceDate: string
  daysOutstanding: number
  lastPaymentAt: string | null
  agingBand: "RECENT" | "OVERDUE" | "HIGH_VALUE"
  nhisStatus: "NHIS" | "SELF_PAY"
}

export type DailyCollectionSummary = {
  date: string
  totalCollected: number
  invoiceCount: number
  reversedAmount: number
  byMethod: Array<{ method: PaymentMethod; amount: number; count: number }>
  byOfficer: Array<{ officer: string; amount: number; count: number }>
  byDepartment: Array<{ department: string; amount: number; count: number }>
  hourly: Array<{ hour: string; amount: number }>
  transactions: PaymentListItem[]
}

export type BillingReportFilters = {
  dateFrom?: string
  dateTo?: string
  departmentId?: string
  paymentMethod?: PaymentMethod
  invoiceStatus?: InvoiceStatus
  billingOfficerId?: string
  serviceType?: string
  reportType?: string
}

export type BillingReportSummary = {
  totalBilled: number
  totalCollected: number
  outstandingBalance: number
  reversedAmount: number
  invoiceCount: number
  paymentCount: number
  averageInvoiceValue: number
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  byMethod: Array<{ label: string; amount: number }>
  byDepartment: Array<{ label: string; amount: number }>
  byServiceType: Array<{ label: string; amount: number }>
  exports: Array<{
    id: string
    title: string
    status: string
    generatedAt: string
    generatedByName: string | null
  }>
}

export type BillingNotificationItem = {
  id: string
  status: NotificationStatus
  priority: string
  title: string
  body: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  readAt: string | null
  createdAt: string
}

export type ReceiptDetail = {
  facility: { name: string; address: string | null; phone: string | null; email: string | null }
  receiptNo: string
  invoiceNo: string
  patient: BillingPatientReference
  payment: PaymentListItem
  totalAmount: number
  amountPaidBefore: number
  currentPayment: number
  totalPaid: number
  remainingBalance: number
}

export type PatientBillingStatement = {
  patient: BillingPatientReference
  dateFrom: string | null
  dateTo: string | null
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  totalBilled: number
  totalPaid: number
  totalReversed: number
  outstandingBalance: number
}

export type BillingClearance = {
  activeInvoice: InvoiceListItem | null
  amountDue: number
  amountPaid: number
  balance: number
  cleared: boolean
  notes: string
}

export type BillingLookups = {
  invoiceStatuses: InvoiceStatus[]
  paymentStatuses: PaymentStatus[]
  paymentMethods: PaymentMethod[]
  notificationStatuses: NotificationStatus[]
  departments: Array<{ id: string; name: string }>
  billingOfficers: Array<{ id: string; name: string }>
  approvingOfficers: Array<{ id: string; name: string; role: string }>
}
