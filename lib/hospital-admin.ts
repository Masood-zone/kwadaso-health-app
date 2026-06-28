import type { NextRequest } from "next/server"

import { getCurrentStaff, requireRoleApi } from "@/lib/auth-session"
import type { AuthenticatedStaff } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
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
import { prisma } from "@/lib/prisma"
import type {
  HospitalAdminAppointmentListItem,
  HospitalAdminAuditLogListItem,
  HospitalAdminDepartmentListItem,
  HospitalAdminEnumLookups,
  HospitalAdminNotificationListItem,
  HospitalAdminQueueItem,
  HospitalAdminReportExportListItem,
  HospitalAdminSettingsPayload,
  HospitalAdminStaffListItem,
} from "@/types/hospital-admin"

export const hospitalAdminAssignableRoles = [
  StaffRole.HOSPITAL_ADMIN,
  StaffRole.M_AND_E_OFFICER,
  StaffRole.RECORDS_OFFICER,
  StaffRole.FRONT_DESK,
  StaffRole.DOCTOR,
  StaffRole.PHYSICIAN_ASSISTANT,
  StaffRole.NURSE,
  StaffRole.LAB_TECHNICIAN,
  StaffRole.PHARMACIST,
  StaffRole.BILLING_OFFICER,
] as const

export const clinicalAppointmentRoles = [
  StaffRole.DOCTOR,
  StaffRole.PHYSICIAN_ASSISTANT,
  StaffRole.NURSE,
] as const

export const hospitalAdminSystemSettingDefaults = {
  "patient.numberPrefix": "SDA-P",
  "invoice.numberPrefix": "INV-SDA",
  "appointment.defaultSlotMinutes": 30,
}

export async function getSignedInHospitalAdmin(
  request?: NextRequest | Request
) {
  return getCurrentStaff(request)
}

export async function requireHospitalAdminApi(request: NextRequest) {
  const result = await requireRoleApi(request, ["HOSPITAL_ADMIN"])
  if (result.response) return result

  if (!result.staff?.facilityId) {
    return {
      staff: result.staff,
      response: Response.json(
        {
          success: false,
          message: "Hospital administrator is not assigned to a facility.",
          code: "FACILITY_REQUIRED",
        },
        { status: 403 }
      ),
    }
  }

  return result
}

export function assertSameFacility(
  record: { facilityId?: string | null } | null | undefined,
  actor: AuthenticatedStaff
) {
  return Boolean(record?.facilityId && record.facilityId === actor.facilityId)
}

export function assertNotSuperAdmin(role: StaffRole) {
  return hospitalAdminAssignableRoles.includes(
    role as (typeof hospitalAdminAssignableRoles)[number]
  )
}

export function getHospitalAdminLookups(): HospitalAdminEnumLookups {
  return {
    staffRoles: Object.values(StaffRole),
    assignableStaffRoles: [...hospitalAdminAssignableRoles],
    userStatuses: Object.values(UserStatus),
    departmentTypes: Object.values(DepartmentType),
    appointmentStatuses: Object.values(AppointmentStatus),
    queueStatuses: Object.values(QueueStatus),
    triagePriorities: Object.values(TriagePriority),
    reportTypes: Object.values(ReportType),
    notificationTypes: Object.values(NotificationType),
    notificationStatuses: Object.values(NotificationStatus),
    messagePriorities: Object.values(MessagePriority),
    auditActions: Object.values(AuditAction),
  }
}

export async function getHospitalAdminSettings(
  facilityId: string
): Promise<HospitalAdminSettingsPayload> {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
  })

  if (!facility) throw new Error("Facility was not found.")

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(hospitalAdminSystemSettingDefaults) } },
  })
  const system = { ...hospitalAdminSystemSettingDefaults }

  for (const setting of settings) {
    if (setting.key in system) {
      const key = setting.key as keyof typeof system
      system[key] = setting.value as never
    }
  }

  return {
    facility: {
      id: facility.id,
      code: facility.code,
      name: facility.name,
      phone: facility.phone,
      email: facility.email,
      address: facility.address,
      municipality: facility.municipality,
      region: facility.region,
    },
    system,
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

export async function writeHospitalAdminAuditLog({
  request,
  actor,
  action,
  entityType,
  entityId,
  description,
  before,
  after,
}: {
  request: NextRequest
  actor: AuthenticatedStaff
  action: AuditAction
  entityType: string
  entityId?: string | null
  description: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}) {
  const meta = getRequestAuditMeta(request)
  await prisma.auditLog.create({
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

export function serializeHospitalAdminStaff(user: {
  id: string
  staffId: string
  firstName: string
  lastName: string
  otherNames: string | null
  name: string
  email: string
  phone: string | null
  jobTitle: string | null
  defaultRole: StaffRole
  status: UserStatus
  departmentId: string | null
  department?: { name: string } | null
  lastLoginAt: Date | null
  createdAt: Date
}): HospitalAdminStaffListItem {
  return {
    id: user.id,
    staffId: user.staffId,
    firstName: user.firstName,
    lastName: user.lastName,
    otherNames: user.otherNames,
    name: user.name,
    email: user.email,
    phone: user.phone,
    jobTitle: user.jobTitle,
    role: user.defaultRole,
    status: user.status,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }
}

export function serializeHospitalAdminDepartment(department: {
  id: string
  code: string
  name: string
  description: string | null
  type: DepartmentType
  isActive: boolean
  createdAt: Date
  _count?: { staff: number }
}): HospitalAdminDepartmentListItem {
  return {
    id: department.id,
    code: department.code,
    name: department.name,
    description: department.description,
    type: department.type,
    isActive: department.isActive,
    staffCount: department._count?.staff ?? 0,
    createdAt: department.createdAt.toISOString(),
  }
}

export function serializeHospitalAdminAppointment(appointment: {
  id: string
  appointmentNo: string
  patientId: string
  departmentId: string | null
  clinicianId: string | null
  title: string | null
  reason: string | null
  notes: string | null
  scheduledAt: Date
  durationMinutes: number
  status: AppointmentStatus
  checkedInAt: Date | null
  cancelledAt: Date | null
  cancellationReason: string | null
  patient: { firstName: string; lastName: string; patientNo: string }
  department?: { name: string } | null
  clinician?: { name: string } | null
}): HospitalAdminAppointmentListItem {
  return {
    id: appointment.id,
    appointmentNo: appointment.appointmentNo,
    patientId: appointment.patientId,
    patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
    patientNo: appointment.patient.patientNo,
    departmentId: appointment.departmentId,
    departmentName: appointment.department?.name ?? null,
    clinicianId: appointment.clinicianId,
    clinicianName: appointment.clinician?.name ?? null,
    title: appointment.title,
    reason: appointment.reason,
    notes: appointment.notes,
    scheduledAt: appointment.scheduledAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    checkedInAt: appointment.checkedInAt?.toISOString() ?? null,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    cancellationReason: appointment.cancellationReason,
  }
}

export function serializeHospitalAdminQueueItem(queue: {
  id: string
  queueNo: string
  patientId: string
  appointmentId: string | null
  departmentId: string
  assignedToId: string | null
  priority: TriagePriority
  status: QueueStatus
  reason: string | null
  notes: string | null
  arrivedAt: Date
  calledAt: Date | null
  completedAt: Date | null
  cancelledAt: Date | null
  cancellationReason: string | null
  patient: { firstName: string; lastName: string; patientNo: string }
  department: { name: string }
  assignedTo?: { name: string } | null
}): HospitalAdminQueueItem {
  return {
    id: queue.id,
    queueNo: queue.queueNo,
    patientId: queue.patientId,
    patientName: `${queue.patient.firstName} ${queue.patient.lastName}`,
    patientNo: queue.patient.patientNo,
    appointmentId: queue.appointmentId,
    departmentId: queue.departmentId,
    departmentName: queue.department.name,
    assignedToId: queue.assignedToId,
    assignedToName: queue.assignedTo?.name ?? null,
    priority: queue.priority,
    status: queue.status,
    reason: queue.reason,
    notes: queue.notes,
    arrivedAt: queue.arrivedAt.toISOString(),
    calledAt: queue.calledAt?.toISOString() ?? null,
    completedAt: queue.completedAt?.toISOString() ?? null,
    cancelledAt: queue.cancelledAt?.toISOString() ?? null,
    cancellationReason: queue.cancellationReason,
  }
}

export function serializeHospitalAdminReportExport(report: {
  id: string
  type: ReportType
  title: string
  status: string
  dateFrom: Date | null
  dateTo: Date | null
  parameters: Prisma.JsonValue | null
  rowCount: number | null
  generatedById: string | null
  generatedAt: Date
  generatedBy?: { name: string } | null
}): HospitalAdminReportExportListItem {
  return {
    id: report.id,
    type: report.type,
    title: report.title,
    status: report.status,
    dateFrom: report.dateFrom?.toISOString() ?? null,
    dateTo: report.dateTo?.toISOString() ?? null,
    parameters: report.parameters,
    rowCount: report.rowCount,
    generatedBy: report.generatedBy?.name ?? null,
    generatedById: report.generatedById,
    generatedAt: report.generatedAt.toISOString(),
  }
}

export function serializeHospitalAdminNotification(notification: {
  id: string
  title: string
  body: string | null
  type: NotificationType
  priority: MessagePriority
  status: NotificationStatus
  targetRole: StaffRole | null
  targetDepartmentId: string | null
  recipientId: string | null
  createdById: string | null
  expiresAt: Date | null
  readAt: Date | null
  createdAt: Date
  targetDepartment?: { name: string } | null
  recipient?: { name: string } | null
  createdBy?: { name: string } | null
}): HospitalAdminNotificationListItem {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.body,
    type: notification.type,
    priority: notification.priority,
    status: notification.status,
    targetRole: notification.targetRole,
    targetDepartmentId: notification.targetDepartmentId,
    targetDepartmentName: notification.targetDepartment?.name ?? null,
    recipientUserId: notification.recipientId,
    recipientName: notification.recipient?.name ?? null,
    createdById: notification.createdById,
    createdByName: notification.createdBy?.name ?? null,
    expiresAt: notification.expiresAt?.toISOString() ?? null,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }
}

export function serializeHospitalAdminAuditLog(log: {
  id: string
  actorId: string | null
  action: AuditAction
  entityType: string
  entityId: string | null
  description: string | null
  before: Prisma.JsonValue | null
  after: Prisma.JsonValue | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  actor?: { name: string } | null
}): HospitalAdminAuditLogListItem {
  return {
    id: log.id,
    actorId: log.actorId,
    actorName: log.actor?.name ?? "System",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    description: log.description,
    before: log.before,
    after: log.after,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }
}
