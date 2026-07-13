"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { laboratoryGet, laboratoryMutate, laboratoryQuery } from "@/services/laboratory/client"
import type { LabTestCatalogItem, LabTestCreatePayload, LabTestUpdatePayload, LaboratoryPage } from "@/types/laboratory"

export type CatalogFilters = { search?: string; category?: string; active?: boolean; page?: number; pageSize?: number }

export function useLabCatalog(filters: CatalogFilters = {}) {
  return useQuery({ queryKey: ["laboratory", "test-catalog", filters], queryFn: () => laboratoryGet<LaboratoryPage<LabTestCatalogItem>>(laboratoryQuery("/laboratory/test-catalog", filters)) })
}

export function useCreateLabTest() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (payload: LabTestCreatePayload) => laboratoryMutate<LabTestCatalogItem, LabTestCreatePayload>("post", "/laboratory/test-catalog", payload), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["laboratory", "test-catalog"] }); queryClient.invalidateQueries({ queryKey: ["laboratory", "lookups"] }) } })
}

export function useUpdateLabTest() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: LabTestUpdatePayload }) => laboratoryMutate<LabTestCatalogItem, LabTestUpdatePayload>("patch", `/laboratory/test-catalog/${id}`, payload), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["laboratory", "test-catalog"] }); queryClient.invalidateQueries({ queryKey: ["laboratory", "lookups"] }) } })
}
