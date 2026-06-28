import type {
  AuditAction,
  DepartmentType,
  FacilityType,
  StaffRole,
  UserStatus,
} from "@/lib/generated/prisma/enums"

export type SuperAdminStaffSummary = {
  id: string
  staffId: string
  name: string
  email: string
  phone: string | null
  jobTitle: string | null
  defaultRole: StaffRole
  status: UserStatus
  departmentId: string | null
  departmentName: string | null
  facilityName: string
  lastLoginAt: string | null
  createdAt: string
}

export type SuperAdminDepartmentSummary = {
  id: string
  code: string
  name: string
  type: DepartmentType
  isActive: boolean
  staffCount: number
  createdAt: string
}

export type SuperAdminPermission = {
  id: string
  key: string
  name: string
  module: string
  description: string | null
}

export type SuperAdminRoleMatrix = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  users: number
  permissions: string[]
}

export type SuperAdminFacilitySettings = {
  id: string
  code: string
  name: string
  type: FacilityType
  phone: string | null
  email: string | null
  address: string | null
  municipality: string | null
  region: string | null
  isActive: boolean
}

export type SuperAdminSystemSettings = {
  "session.timeoutMinutes": number
  "audit.retentionDays": number
  "patient.numberPrefix": string
  "invoice.numberPrefix": string
  "appointment.defaultSlotMinutes": number
}

export type SuperAdminSettingsData = {
  facility: SuperAdminFacilitySettings
  system: SuperAdminSystemSettings
}

export type SuperAdminAuditLogItem = {
  id: string
  actorName: string
  actorEmail: string | null
  action: AuditAction
  entityType: string
  entityId: string | null
  description: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export type SuperAdminLookups = {
  roles: StaffRole[]
  statuses: UserStatus[]
  departmentTypes: DepartmentType[]
  facilityTypes: FacilityType[]
  auditActions: AuditAction[]
}

export type SuperAdminManagementData = {
  lookups: SuperAdminLookups
  staff: SuperAdminStaffSummary[]
  departments: SuperAdminDepartmentSummary[]
  permissions: SuperAdminPermission[]
  roles: SuperAdminRoleMatrix[]
  settings: SuperAdminSettingsData
  auditLogs: SuperAdminAuditLogItem[]
  auditPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
