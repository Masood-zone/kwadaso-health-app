import type { Metadata } from "next"

import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell"

export const metadata: Metadata = sectionMetadata({
  title: "Super Admin Portal",
  description:
    "System administration area for staff accounts, roles, departments, settings, and audit logs.",
  path: "/super-admin/dashboard",
})

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
