import type { Metadata } from "next"

import { OversightWipPage } from "@/components/oversight/oversight-wip-page"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({
  title: "Municipal Oversight",
  description: "Municipal health reporting and monitoring workspace.",
  path: "/oversight",
})

export default async function OversightPage() {
  const staff = await requireRolePage("/oversight", [
    "MUNICIPAL_HEALTH_DIRECTOR",
    "M_AND_E_OFFICER",
  ])

  return (
    <OversightWipPage
      facilityName={staff.facility.name}
      role={staff.defaultRole}
      userName={staff.name}
    />
  )
}
