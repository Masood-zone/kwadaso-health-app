import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { DashboardOverviewPage } from "@/components/super-admin/dashboard-overview-page"
import { requireRolePage } from "@/lib/auth-session"
import { loadSuperAdminDashboardSummary } from "@/lib/dashboard-loaders/super-admin"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function SuperAdminDashboardPage() {
  const staff = await requireRolePage("/super-admin/dashboard", ["SUPER_ADMIN"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: dashboardQueryKeys.superAdminSummary,
    queryFn: () => loadSuperAdminDashboardSummary(staff),
  })

  return <HydrationBoundary state={dehydrate(queryClient)}><DashboardOverviewPage /></HydrationBoundary>
}
