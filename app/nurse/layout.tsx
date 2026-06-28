import type { Metadata } from "next"

import { NurseShell } from "@/components/nurse/nurse-shell"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({
  title: "Nurse Triage Portal",
  description:
    "Nursing and triage workspace for live queues, vital signs capture, emergency flags, immunizations, and notifications.",
  path: "/nurse/dashboard",
})

export default async function NurseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await requireRolePage("/nurse", ["NURSE"])

  return (
    <NurseShell
      userName={staff.name}
      roleLabel="Nurse / Triage Officer"
      facilityName={staff.facility.name}
    >
      {children}
    </NurseShell>
  )
}
