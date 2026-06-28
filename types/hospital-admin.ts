import type {
  AppointmentStatus,
  AuditAction,
  DepartmentType,
  MessagePriority,
  NotificationStatus,
  NotificationType,
  QueueStatus,
  ReportType,
  StaffRole,
  TriagePriority,
  UserStatus,
} from "@/lib/generated/prisma/enums"
import type { DashboardMetric } from "@/types/dashboard"

export type HospitalAdminDashboardSummary = {
  facilityName: string
  metrics: DashboardMetric[]
}

export type HospitalAdminStaffListItem = {
  id: string
  staffId: string
  firstName: string
  lastName: string
  otherNames: string | null
  name: string
  email: string
  phone: string | null
  jobTitle: string | null
  role: StaffRole
  status: UserStatus
  departmentId: string | null
  departmentName: string | null
  lastLoginAt: string | null
  createdAt: string
}

export type HospitalAdminStaffCreatePayload = {
  staffId: string
  firstName: string
  lastName: string
  otherNames?: string | null
  email: string
  phone: string
  jobTitle?: string | null
  role: StaffRole
  departmentId: string
  status: UserStatus
  temporaryPassword: string
}

export type HospitalAdminStaffUpdatePayload = Omit<
  HospitalAdminStaffCreatePayload,
  "temporaryPassword"
> & {
  temporaryPassword?: string
}

export type HospitalAdminStaffFilters = {
  search?: string
  status?: UserStatus | ""
  role?: StaffRole | ""
  departmentId?: string
}

export type HospitalAdminDepartmentListItem = {
  id: string
  code: string
  name: string
  description: string | null
  type: DepartmentType
  isActive: boolean
  staffCount: number
  createdAt: string
}

export type HospitalAdminDepartmentCreatePayload = {
  code: string
  name: string
  description?: string | null
  type: DepartmentType
  isActive: boolean
}

export type HospitalAdminDepartmentUpdatePayload =
  HospitalAdminDepartmentCreatePayload

export type HospitalAdminAppointmentListItem = {
  id: string
  appointmentNo: string
  patientId: string
  patientName: string
  patientNo: string
  departmentId: string | null
  departmentName: string | null
  clinicianId: string | null
  clinicianName: string | null
  title: string | null
  reason: string | null
  notes: string | null
  scheduledAt: string
  durationMinutes: number
  status: AppointmentStatus
  checkedInAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

export type HospitalAdminAppointmentCreatePayload = {
  patientId: string
  departmentId: string
  clinicianId?: string | null
  scheduledAt: string
  durationMinutes: number
  title?: string | null
  reason?: string | null
  notes?: string | null
  status: AppointmentStatus
}

export type HospitalAdminAppointmentUpdatePayload =
  HospitalAdminAppointmentCreatePayload & {
    cancellationReason?: string | null
  }

export type HospitalAdminAppointmentFilters = {
  dateFrom?: string
  dateTo?: string
  status?: AppointmentStatus | ""
  departmentId?: string
  clinicianId?: string
  patientSearch?: string
}

export type HospitalAdminPatientLookupItem = {
  id: string
  patientNo: string
  name: string
  firstName: string
  lastName: string
  gender: string
  age: number | null
  phone: string | null
  nhisNumber: string | null
  status: string
}

export type HospitalAdminQueueItem = {
  id: string
  queueNo: string
  patientId: string
  patientName: string
  patientNo: string
  appointmentId: string | null
  departmentId: string
  departmentName: string
  assignedToId: string | null
  assignedToName: string | null
  priority: TriagePriority
  status: QueueStatus
  reason: string | null
  notes: string | null
  arrivedAt: string
  calledAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

export type HospitalAdminQueueCreatePayload = {
  patientId: string
  appointmentId?: string | null
  departmentId: string
  assignedToId?: string | null
  priority: TriagePriority
  reason?: string | null
  notes?: string | null
}

export type HospitalAdminQueueUpdatePayload = {
  assignedToId?: string | null
  priority: TriagePriority
  status: QueueStatus
  reason?: string | null
  notes?: string | null
  cancellationReason?: string | null
}

export type HospitalAdminQueueFilters = {
  date?: string
  departmentId?: string
  status?: QueueStatus | ""
  priority?: TriagePriority | ""
}

export type HospitalAdminSettingsPayload = {
  facility: {
    id: string
    code: string
    name: string
    phone: string | null
    email: string | null
    address: string | null
    municipality: string | null
    region: string | null
  }
  system: {
    "patient.numberPrefix": string
    "invoice.numberPrefix": string
    "appointment.defaultSlotMinutes": number
  }
}

export type HospitalAdminReportExportListItem = {
  id: string
  type: ReportType
  title: string
  status: string
  dateFrom: string | null
  dateTo: string | null
  parameters: unknown
  rowCount: number | null
  generatedBy: string | null
  generatedById: string | null
  generatedAt: string
}

export type HospitalAdminReportExportCreatePayload = {
  type: ReportType
  title: string
  dateFrom?: string | null
  dateTo?: string | null
  parameters?: Record<string, unknown>
  rowCount?: number | null
  status?: string
}

export type HospitalAdminNotificationListItem = {
  id: string
  title: string
  message: string | null
  type: NotificationType
  priority: MessagePriority
  status: NotificationStatus
  targetRole: StaffRole | null
  targetDepartmentId: string | null
  targetDepartmentName: string | null
  recipientUserId: string | null
  recipientName: string | null
  createdById: string | null
  createdByName: string | null
  expiresAt: string | null
  readAt: string | null
  createdAt: string
}

export type HospitalAdminNotificationCreatePayload = {
  title: string
  message?: string | null
  type: NotificationType
  priority: MessagePriority
  targetRole?: StaffRole | null
  targetDepartmentId?: string | null
  recipientUserId?: string | null
  expiresAt?: string | null
}

export type HospitalAdminNotificationUpdatePayload = {
  title?: string
  message?: string | null
  priority?: MessagePriority
  status?: NotificationStatus
  targetRole?: StaffRole | null
  targetDepartmentId?: string | null
  recipientUserId?: string | null
  expiresAt?: string | null
}

export type HospitalAdminAuditLogListItem = {
  id: string
  actorId: string | null
  actorName: string
  action: AuditAction
  entityType: string
  entityId: string | null
  description: string | null
  before: unknown
  after: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export type HospitalAdminEnumLookups = {
  staffRoles: StaffRole[]
  assignableStaffRoles: StaffRole[]
  userStatuses: UserStatus[]
  departmentTypes: DepartmentType[]
  appointmentStatuses: AppointmentStatus[]
  queueStatuses: QueueStatus[]
  triagePriorities: TriagePriority[]
  reportTypes: ReportType[]
  notificationTypes: NotificationType[]
  notificationStatuses: NotificationStatus[]
  messagePriorities: MessagePriority[]
  auditActions: AuditAction[]
}
