import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { LaboratoryDashboard } from "@/components/laboratory/laboratory-dashboard"
import { requireRolePage } from "@/lib/auth-session"
import { loadLaboratoryDashboard } from "@/lib/dashboard-loaders/laboratory"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function LaboratoryHomeRoute() {
  const staff = await requireRolePage("/laboratory", ["LAB_TECHNICIAN"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.laboratory, queryFn: () => loadLaboratoryDashboard(staff) })
  return <HydrationBoundary state={dehydrate(queryClient)}><LaboratoryDashboard /></HydrationBoundary>
}
