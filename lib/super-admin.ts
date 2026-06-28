import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import type { AuthenticatedStaff } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  AuditAction,
  DepartmentType,
  FacilityType,
  StaffRole,
  UserStatus,
} from "@/lib/generated/prisma/enums"
import type {
  SuperAdminDepartmentSummary,
  SuperAdminPermission,
  SuperAdminRoleMatrix,
  SuperAdminSettingsData,
  SuperAdminStaffSummary,
  SuperAdminSystemSettings,
} from "@/types/super-admin"

export const staffRoles = Object.values(StaffRole)
export const userStatuses = Object.values(UserStatus)
export const departmentTypes = Object.values(DepartmentType)
export const facilityTypes = Object.values(FacilityType)
export const auditActions = Object.values(AuditAction)

export const systemSettingDefaults: SuperAdminSystemSettings = {
  "session.timeoutMinutes": 30,
  "audit.retentionDays": 365,
  "patient.numberPrefix": "SDA-P",
  "invoice.numberPrefix": "INV-SDA",
  "appointment.defaultSlotMinutes": 30,
}

export const permissionCatalog = [
  ["dashboard.view", "View System Dashboard", "Dashboard"],
  ["staff.view", "View Staff Accounts", "Staff"],
  ["staff.create", "Create Staff Accounts", "Staff"],
  ["staff.update", "Update Staff Accounts", "Staff"],
  ["staff.status", "Change Staff Status", "Staff"],
  ["roles.view", "View Roles", "Roles"],
  ["roles.permissions", "Manage Role Permissions", "Roles"],
  ["permissions.view", "View Permission Catalog", "Permissions"],
  ["audit.view", "View Audit Logs", "Audit"],
  ["settings.view", "View Hospital Settings", "Settings"],
  ["settings.update", "Update Hospital Settings", "Settings"],
  ["departments.view", "View Departments", "Departments"],
  ["departments.create", "Create Departments", "Departments"],
  ["departments.update", "Update Departments", "Departments"],
  ["patients.view", "View Patients", "Patients"],
  ["patients.manage", "Manage Patients", "Patients"],
  ["clinical.view", "View Clinical Workflows", "Clinical"],
  ["clinical.manage", "Manage Clinical Workflows", "Clinical"],
  ["laboratory.view", "View Laboratory", "Laboratory"],
  ["laboratory.manage", "Manage Laboratory", "Laboratory"],
  ["pharmacy.view", "View Pharmacy", "Pharmacy"],
  ["pharmacy.manage", "Manage Pharmacy", "Pharmacy"],
  ["billing.view", "View Billing", "Billing"],
  ["billing.manage", "Manage Billing", "Billing"],
  ["reports.view", "View Reports", "Reports"],
  ["reports.export", "Export Reports", "Reports"],
  ["referrals.view", "View Referrals", "Referrals"],
  ["referrals.manage", "Manage Referrals", "Referrals"],
  ["notifications.view", "View Notifications", "Notifications"],
  ["notifications.manage", "Manage Notifications", "Notifications"],
  ["sync.view", "View Sync Jobs", "Sync"],
  ["sync.manage", "Manage Sync Jobs", "Sync"],
] as const

export async function ensureSystemRolesAndPermissions() {
  const permissions = await Promise.all(
    permissionCatalog.map(([key, name, module]) =>
      prisma.permission.upsert({
        where: { key },
        update: { name, module },
        create: { key, name, module },
      })
    )
  )

  const permissionIds = permissions.map((permission) => permission.id)

  for (const roleName of staffRoles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { isSystem: true },
      create: {
        name: roleName,
        description: roleName.replaceAll("_", " "),
        isSystem: true,
      },
    })

    if (roleName === "SUPER_ADMIN") {
      await Promise.all(
        permissionIds.map((permissionId) =>
          prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId } },
            update: {},
            create: { roleId: role.id, permissionId },
          })
        )
      )
    }
  }
}

export async function getPrimaryFacility() {
  const facility = await prisma.facility.findFirst({
    where: { code: "SDA-KWADASO" },
  })

  if (facility) return facility

  return prisma.facility.findFirst({
    where: { type: "HOSPITAL" },
    orderBy: { createdAt: "asc" },
  })
}

export async function syncUserPrimaryRole(userId: string, roleName: StaffRole) {
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: { isSystem: true },
    create: {
      name: roleName,
      description: roleName.replaceAll("_", " "),
      isSystem: true,
    },
  })

  await prisma.userRole.deleteMany({ where: { userId } })
  await prisma.userRole.create({
    data: {
      userId,
      roleId: role.id,
    },
  })
}

export function getRequestAuditMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  }
}

export async function writeAuditLog({
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

export function serializeStaff(user: {
  id: string
  staffId: string
  name: string
  email: string
  phone: string | null
  jobTitle: string | null
  defaultRole: StaffRole
  status: UserStatus
  departmentId: string | null
  department?: { name: string } | null
  facility: { name: string }
  lastLoginAt: Date | null
  createdAt: Date
}): SuperAdminStaffSummary {
  return {
    id: user.id,
    staffId: user.staffId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    jobTitle: user.jobTitle,
    defaultRole: user.defaultRole,
    status: user.status,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    facilityName: user.facility.name,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }
}

export function serializeDepartment(department: {
  id: string
  code: string
  name: string
  type: DepartmentType
  isActive: boolean
  createdAt: Date
  _count: { staff: number }
}): SuperAdminDepartmentSummary {
  return {
    id: department.id,
    code: department.code,
    name: department.name,
    type: department.type,
    isActive: department.isActive,
    staffCount: department._count.staff,
    createdAt: department.createdAt.toISOString(),
  }
}

export function serializePermission(permission: {
  id: string
  key: string
  name: string
  module: string
  description: string | null
}): SuperAdminPermission {
  return permission
}

export function serializeRole(role: {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  _count: { users: number }
  permissions: { permission: { key: string } }[]
}): SuperAdminRoleMatrix {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    users: role._count.users,
    permissions: role.permissions.map((item) => item.permission.key),
  }
}

export async function getSettingsData(): Promise<SuperAdminSettingsData> {
  const facility = await getPrimaryFacility()

  if (!facility) {
    throw new Error("Primary facility is not configured.")
  }

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(systemSettingDefaults) } },
  })

  const system = { ...systemSettingDefaults }
  for (const setting of settings) {
    if (setting.key in system) {
      const key = setting.key as keyof SuperAdminSystemSettings
      system[key] = setting.value as never
    }
  }

  return {
    facility: {
      id: facility.id,
      code: facility.code,
      name: facility.name,
      type: facility.type,
      phone: facility.phone,
      email: facility.email,
      address: facility.address,
      municipality: facility.municipality,
      region: facility.region,
      isActive: facility.isActive,
    },
    system,
  }
}
