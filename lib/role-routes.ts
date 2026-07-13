import type { StaffRole } from "@/lib/generated/prisma/enums"

export const dashboardRoutes: Partial<Record<StaffRole, string>> = {
  SUPER_ADMIN: "/super-admin/dashboard",
  HOSPITAL_ADMIN: "/hospital-admin/dashboard",
  RECORDS_OFFICER: "/records-officer",
  FRONT_DESK: "/records-officer",
  NURSE: "/nurse/dashboard",
  LAB_TECHNICIAN: "/laboratory",
  DOCTOR: "/clinician",
  PHYSICIAN_ASSISTANT: "/clinician",
  PHARMACIST: "/pharmacy",
}

export function getDashboardRoute(role?: StaffRole | null) {
  if (!role) return "/unauthorized"

  return dashboardRoutes[role] ?? "/unauthorized"
}
