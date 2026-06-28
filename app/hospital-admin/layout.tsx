import type { Metadata } from "next"

import { HospitalAdminShell } from "@/components/hospital-admin/hospital-admin-shell"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({
  title: "Hospital Admin Portal",
  description:
    "Operational command center for SDA Hospital Kwadaso appointments, queues, staff, departments, reports, and notifications.",
  path: "/hospital-admin/dashboard",
})

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
