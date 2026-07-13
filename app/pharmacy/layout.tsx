import type { Metadata } from "next"

import { PharmacyShell } from "@/components/pharmacy/pharmacy-shell"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({ title: "Pharmacy Workspace", description: "Facility-scoped prescription dispensing, medicine stock, safety, and reporting workspace.", path: "/pharmacy" })

export default async function PharmacyLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireRolePage("/pharmacy", ["PHARMACIST"])
  return <PharmacyShell userName={staff.name} facilityName={staff.facility.name}>{children}</PharmacyShell>
}
