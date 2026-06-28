import { requireRolePage } from "@/lib/auth-session"
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await requireRolePage("/super-admin/dashboard", ["SUPER_ADMIN"])

  return (
    <SuperAdminShell
      userName={staff.name}
      roleLabel="Super Admin"
      facilityName={staff.facility.name}
    >
      {children}
    </SuperAdminShell>
  )
}
