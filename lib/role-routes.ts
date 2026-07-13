import type { StaffRole } from "@/lib/generated/prisma/enums"

export const dashboardRoutes: Partial<Record<StaffRole, string>> = {
  SUPER_ADMIN: "/super-admin/dashboard",
  HOSPITAL_ADMIN: "/hospital-admin/dashboard",
  MUNICIPAL_HEALTH_DIRECTOR: "/oversight",
  M_AND_E_OFFICER: "/oversight",
  RECORDS_OFFICER: "/records-officer",
  FRONT_DESK: "/records-officer",
  NURSE: "/nurse/dashboard",
  LAB_TECHNICIAN: "/laboratory",
  DOCTOR: "/clinician",
  PHYSICIAN_ASSISTANT: "/clinician",
  PHARMACIST: "/pharmacy",
  BILLING_OFFICER: "/billing",
}

export function getDashboardRoute(role?: StaffRole | null) {
  if (!role) return "/unauthorized"

  return dashboardRoutes[role] ?? "/unauthorized"
}
