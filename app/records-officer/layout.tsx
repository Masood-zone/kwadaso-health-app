import type { Metadata } from "next"

import { RecordsOfficerShell } from "@/components/records-officer/records-officer-shell"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({
  title: "Records Office Portal",
  description:
    "Patient records desk for registration, appointments, check-in, queue management, visit history, and document metadata.",
  path: "/records-officer",
})

export default async function RecordsOfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await requireRolePage("/records-officer", [
    "RECORDS_OFFICER",
    "FRONT_DESK",
  ])

  return (
    <RecordsOfficerShell
      userName={staff.name}
      roleLabel={staff.defaultRole === "FRONT_DESK" ? "Front Desk" : "Records Officer"}
      facilityName={staff.facility.name}
    >
      {children}
    </RecordsOfficerShell>
  )
}
