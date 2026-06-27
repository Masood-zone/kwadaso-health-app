import { requireRolePage } from "@/lib/auth-session"
import { NurseDashboard } from "@/components/nurse/nurse-dashboard"

export default async function NurseDashboardPage() {
  const staff = await requireRolePage("/nurse/dashboard", ["NURSE"])

  return (
    <NurseDashboard
      userName={staff.name}
      roleLabel="Nurse / Triage Officer"
      fallbackFacilityName={staff.facility.name}
    />
  )
}
