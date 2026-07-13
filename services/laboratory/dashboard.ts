"use client"

import { useQuery } from "@tanstack/react-query"

import { laboratoryGet } from "@/services/laboratory/client"
import type { LaboratoryDashboardSummary, LaboratoryLookups } from "@/types/laboratory"

export function useLaboratoryDashboard() {
  return useQuery({ queryKey: ["laboratory", "dashboard"], queryFn: () => laboratoryGet<LaboratoryDashboardSummary>("/laboratory/dashboard") })
}

export function useLaboratoryLookups() {
  return useQuery({ queryKey: ["laboratory", "lookups"], queryFn: () => laboratoryGet<LaboratoryLookups>("/laboratory/lookups") })
}
