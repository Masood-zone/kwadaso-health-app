import { HospitalAdminShell } from "@/components/hospital-admin/hospital-admin-shell"
import { requireRolePage } from "@/lib/auth-session"

export default async function HospitalAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await requireRolePage("/hospital-admin/dashboard", [
    "HOSPITAL_ADMIN",
  ])

  return (
    <HospitalAdminShell
      userName={staff.name}
      roleLabel="Hospital Administrator"
      facilityName={staff.facility.name}
    >
      {children}
    </HospitalAdminShell>
  )
}
