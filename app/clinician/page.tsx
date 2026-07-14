import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { ClinicianDashboardPage } from "@/components/clinician/clinician-pages"
import { requireRolePage } from "@/lib/auth-session"
import { loadClinicianDashboard } from "@/lib/dashboard-loaders/clinician"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function ClinicianHomeRoute() {
  const staff = await requireRolePage("/clinician", ["DOCTOR", "PHYSICIAN_ASSISTANT"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.clinician, queryFn: () => loadClinicianDashboard(staff) })
  return <HydrationBoundary state={dehydrate(queryClient)}><ClinicianDashboardPage /></HydrationBoundary>
}
