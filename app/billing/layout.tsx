import type { Metadata } from "next"

import { BillingShell } from "@/components/billing/billing-shell"
import { requireRolePage } from "@/lib/auth-session"
import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({ title: "Billing and Accounts Portal", description: "Facility billing workspace for invoices, payments, receipts, balances, NHIS, waivers, and financial reporting.", path: "/billing" })

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireRolePage("/billing", ["BILLING_OFFICER"])
  return <BillingShell userName={staff.name} facilityName={staff.facility.name}>{children}</BillingShell>
}
