"use client"

import { useQuery } from "@tanstack/react-query"

import { laboratoryGet } from "@/services/laboratory/client"
import { dashboardQueryKeys } from "@/lib/query-keys"
import { queryFreshness } from "@/lib/query-client"
import type { LaboratoryDashboardSummary, LaboratoryLookups } from "@/types/laboratory"

export function useLaboratoryDashboard() {
  return useQuery({ queryKey: dashboardQueryKeys.laboratory, queryFn: () => laboratoryGet<LaboratoryDashboardSummary>("/laboratory/dashboard"), staleTime: queryFreshness.dashboard })
}

export function useLaboratoryLookups() {
  return useQuery({ queryKey: ["laboratory", "lookups"], queryFn: () => laboratoryGet<LaboratoryLookups>("/laboratory/lookups"), staleTime: queryFreshness.lookup })
}
