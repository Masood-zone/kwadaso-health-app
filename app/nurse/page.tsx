import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { NurseDashboardPage } from "@/components/nurse/nurse-pages"
import { requireRolePage } from "@/lib/auth-session"
import { loadNurseDashboard } from "@/lib/dashboard-loaders/nurse"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function NurseHomeRoute() {
  const staff = await requireRolePage("/nurse", ["NURSE"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.nurse, queryFn: () => loadNurseDashboard(staff) })
  return <HydrationBoundary state={dehydrate(queryClient)}><NurseDashboardPage /></HydrationBoundary>
}
