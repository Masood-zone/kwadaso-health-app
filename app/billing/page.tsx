import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { BillingDashboardPage } from "@/components/billing/billing-dashboard"
import { requireRolePage } from "@/lib/auth-session"
import { loadBillingDashboard } from "@/lib/dashboard-loaders/billing"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function BillingHomeRoute() {
  const staff = await requireRolePage("/billing", ["BILLING_OFFICER"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.billing, queryFn: () => loadBillingDashboard(staff) })
  return <HydrationBoundary state={dehydrate(queryClient)}><BillingDashboardPage /></HydrationBoundary>
}
