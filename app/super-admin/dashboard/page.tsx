import { requireRolePage } from "@/lib/auth-session"
import { SuperAdminDashboard } from "@/components/super-admin/super-admin-dashboard"

export default async function SuperAdminDashboardPage() {
  const staff = await requireRolePage("/super-admin/dashboard", ["SUPER_ADMIN"])

  return (
    <SuperAdminDashboard
      userName={staff.name}
      roleLabel="Super Admin"
      fallbackFacilityName={staff.facility.name}
    />
  )
}
