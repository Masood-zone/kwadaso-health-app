import { requireRolePage } from "@/lib/auth-session"
import { HospitalAdminDashboard } from "@/components/hospital-admin/hospital-admin-dashboard"

export default async function HospitalAdminDashboardPage() {
  const staff = await requireRolePage("/hospital-admin/dashboard", [
    "HOSPITAL_ADMIN",
  ])

  return (
    <HospitalAdminDashboard
      userName={staff.name}
      roleLabel="Hospital Administrator"
      fallbackFacilityName={staff.facility.name}
    />
  )
}
