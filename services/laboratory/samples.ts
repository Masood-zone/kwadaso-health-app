"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { laboratoryGet, laboratoryMutate, laboratoryQuery } from "@/services/laboratory/client"
import { queryFreshness } from "@/lib/query-client"
import type { LabSampleCreatePayload, LabSampleDetail, LabSampleFilters, LabSampleListItem, LabSampleUpdatePayload, LaboratoryPage } from "@/types/laboratory"

export function useLabSamples(filters: LabSampleFilters = {}) {
  return useQuery({ queryKey: ["laboratory", "samples", filters], queryFn: () => laboratoryGet<LaboratoryPage<LabSampleListItem>>(laboratoryQuery("/laboratory/samples", filters)), staleTime: queryFreshness.live, refetchInterval: 15_000, refetchIntervalInBackground: false })
}

export function useLabSample(id?: string) {
  return useQuery({ queryKey: ["laboratory", "sample", id], enabled: Boolean(id), queryFn: () => laboratoryGet<LabSampleDetail>(`/laboratory/samples/${id}`) })
}

export function useCollectLabSample() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: LabSampleCreatePayload }) => laboratoryMutate<LabSampleListItem, LabSampleCreatePayload>("post", `/laboratory/requests/${requestId}/samples`, payload),
    onSuccess: (sample) => {
      queryClient.invalidateQueries({ queryKey: ["laboratory", "samples"] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "request", sample.labRequestId] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "requests"] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "dashboard"] })
    },
  })
}

export function useUpdateLabSample() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LabSampleUpdatePayload }) => laboratoryMutate<LabSampleDetail, LabSampleUpdatePayload>("patch", `/laboratory/samples/${id}`, payload),
    onSuccess: (sample) => {
      queryClient.invalidateQueries({ queryKey: ["laboratory", "sample", sample.id] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "samples"] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "request", sample.labRequestId] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "requests"] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "notifications"] })
      queryClient.invalidateQueries({ queryKey: ["laboratory", "dashboard"] })
    },
  })
}
