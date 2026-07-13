import type { Metadata } from "next"

import { LaboratoryShell } from "@/components/laboratory/laboratory-shell"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({
  title: "Laboratory Technician Portal",
  description:
    "Facility laboratory workspace for requests, samples, results, validation, reporting, and critical alerts.",
  path: "/laboratory",
})

export default async function LaboratoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await requireRolePage("/laboratory", ["LAB_TECHNICIAN"])

  return (
    <LaboratoryShell
      userName={staff.name}
      facilityName={staff.facility.name}
    >
      {children}
    </LaboratoryShell>
  )
}
