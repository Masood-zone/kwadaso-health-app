import { NurseShell } from "@/components/nurse/nurse-shell"
import { requireRolePage } from "@/lib/auth-session"

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
