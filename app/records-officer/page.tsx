import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { RecordsOfficerDashboardPage } from "@/components/records-officer/records-officer-pages"
import { requireRolePage } from "@/lib/auth-session"
import { loadRecordsOfficerDashboard } from "@/lib/dashboard-loaders/records-officer"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function RecordsOfficerPage() {
  const staff = await requireRolePage("/records-officer", ["RECORDS_OFFICER", "FRONT_DESK"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.recordsOfficer, queryFn: () => loadRecordsOfficerDashboard(staff) })
  return <HydrationBoundary state={dehydrate(queryClient)}><RecordsOfficerDashboardPage /></HydrationBoundary>
}
