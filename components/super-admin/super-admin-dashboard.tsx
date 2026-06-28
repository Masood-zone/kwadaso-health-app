"use client"

import { DashboardOverviewPage } from "@/components/super-admin/dashboard-overview-page"

type SuperAdminDashboardProps = {
  userName: string
  roleLabel: string
  fallbackFacilityName: string
}

export function SuperAdminDashboard(props: SuperAdminDashboardProps) {
  void props
  return <DashboardOverviewPage />
}
