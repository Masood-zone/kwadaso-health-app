import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { HospitalAdminDashboard } from "@/components/hospital-admin/hospital-admin-dashboard"
import { requireRolePage } from "@/lib/auth-session"
import { loadHospitalAdminDashboard } from "@/lib/dashboard-loaders/hospital-admin"
import { getQueryClient } from "@/lib/query-client"
import { dashboardQueryKeys } from "@/lib/query-keys"

export default async function HospitalAdminDashboardPage() {
  const staff = await requireRolePage("/hospital-admin/dashboard", ["HOSPITAL_ADMIN"])
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.hospitalAdmin, queryFn: () => loadHospitalAdminDashboard(staff) })
  return <HydrationBoundary state={dehydrate(queryClient)}><HospitalAdminDashboard /></HydrationBoundary>
}
