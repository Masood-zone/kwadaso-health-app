import { RecordsOfficerShell } from "@/components/records-officer/records-officer-shell"
import { requireRolePage } from "@/lib/auth-session"

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
