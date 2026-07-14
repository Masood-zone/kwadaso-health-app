"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { laboratoryGet, laboratoryMutate, laboratoryQuery } from "@/services/laboratory/client"
import { queryFreshness } from "@/lib/query-client"
import type { LabRequestDetail, LabRequestFilters, LabRequestQueueItem, LabRequestStatusUpdatePayload, LaboratoryPage } from "@/types/laboratory"

export function useLabRequests(filters: LabRequestFilters = {}) {
  return useQuery({ queryKey: ["laboratory", "requests", filters], queryFn: () => laboratoryGet<LaboratoryPage<LabRequestQueueItem>>(laboratoryQuery("/laboratory/requests", filters)), staleTime: queryFreshness.live, refetchInterval: 15_000, refetchIntervalInBackground: false })
}

export function useLabRequest(id?: string) {
  return useQuery({ queryKey: ["laboratory", "request", id], enabled: Boolean(id), queryFn: () => laboratoryGet<LabRequestDetail>(`/laboratory/requests/${id}`) })
}

export function useUpdateLabRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LabRequestStatusUpdatePayload }) => laboratoryMutate<LabRequestDetail, LabRequestStatusUpdatePayload>("patch", `/laboratory/requests/${id}`, payload),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["laboratory", "requests"] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "request", item.id] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "dashboard"] })
    },
  })
}
