import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { PharmacyDashboardPage } from "@/components/pharmacy/pharmacy-dashboard"
import { requireRolePage } from "@/lib/auth-session"
import { loadPharmacyDashboard } from "@/lib/dashboard-loaders/pharmacy"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function PharmacyHomeRoute() {
  const staff = await requireRolePage("/pharmacy", ["PHARMACIST"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.pharmacy, queryFn: () => loadPharmacyDashboard(staff) })
  return <HydrationBoundary state={dehydrate(queryClient)}><PharmacyDashboardPage /></HydrationBoundary>
}
