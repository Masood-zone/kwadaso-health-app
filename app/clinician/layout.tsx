import type { Metadata } from "next"

import { ClinicianShell } from "@/components/clinician/clinician-shell"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({
  title: "Clinician Portal",
  description:
    "Doctor and Physician Assistant workspace for consultations and clinical care.",
  path: "/clinician",
})

export default async function ClinicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await requireRolePage("/clinician", [
    "DOCTOR",
    "PHYSICIAN_ASSISTANT",
  ])
  return (
    <ClinicianShell
      userName={staff.name}
      roleLabel={
        staff.defaultRole === "DOCTOR" ? "Doctor" : "Physician Assistant"
      }
      facilityName={staff.facility.name}
    >
      {children}
    </ClinicianShell>
  )
}
