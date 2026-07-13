"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { laboratoryGet, laboratoryMutate, laboratoryQuery } from "@/services/laboratory/client"
import type { LaboratoryReportData, LaboratoryReportExport, LaboratoryReportFilters } from "@/types/laboratory"

export function useLaboratoryReports(filters: LaboratoryReportFilters = {}) {
  return useQuery({ queryKey: ["laboratory", "reports", filters], queryFn: () => laboratoryGet<LaboratoryReportData>(laboratoryQuery("/laboratory/reports", filters)) })
}

export function useExportLaboratoryReport() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (payload: LaboratoryReportFilters) => laboratoryMutate<LaboratoryReportExport, LaboratoryReportFilters>("post", "/laboratory/reports/exports", payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laboratory", "reports"] }) })
}
