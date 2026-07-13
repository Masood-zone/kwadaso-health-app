"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { laboratoryGet, laboratoryMutate, laboratoryQuery } from "@/services/laboratory/client"
import type { CriticalResultAlertPayload, LabResultCreatePayload, LabResultDetail, LabResultFilters, LabResultListItem, LabResultUpdatePayload, LaboratoryPage, ResultReleasePayload, ResultValidationPayload } from "@/types/laboratory"

function useRefreshResult() {
  const queryClient = useQueryClient()
  return (result: LabResultDetail) => {
    queryClient.invalidateQueries({ queryKey: ["laboratory", "result", result.id] })
    queryClient.invalidateQueries({ queryKey: ["laboratory", "results"] })
    queryClient.invalidateQueries({ queryKey: ["laboratory", "request", result.requestId] })
    queryClient.invalidateQueries({ queryKey: ["laboratory", "requests"] })
    queryClient.invalidateQueries({ queryKey: ["laboratory", "dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["laboratory", "notifications"] })
    queryClient.invalidateQueries({ queryKey: ["laboratory", "patient", result.patientId] })
  }
}

export function useLabResults(filters: LabResultFilters = {}) {
  return useQuery({ queryKey: ["laboratory", "results", filters], queryFn: () => laboratoryGet<LaboratoryPage<LabResultListItem>>(laboratoryQuery("/laboratory/results", filters)) })
}

export function useLabResult(id?: string) {
  return useQuery({ queryKey: ["laboratory", "result", id], enabled: Boolean(id), queryFn: () => laboratoryGet<LabResultDetail>(`/laboratory/results/${id}`) })
}

export function useCreateLabResult() {
  const refresh = useRefreshResult()
  return useMutation({ mutationFn: ({ requestTestId, payload }: { requestTestId: string; payload: LabResultCreatePayload }) => laboratoryMutate<LabResultDetail, LabResultCreatePayload>("post", `/laboratory/request-tests/${requestTestId}/results`, payload), onSuccess: refresh })
}

export function useUpdateLabResult() {
  const refresh = useRefreshResult()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: LabResultUpdatePayload }) => laboratoryMutate<LabResultDetail, LabResultUpdatePayload>("patch", `/laboratory/results/${id}`, payload), onSuccess: refresh })
}

export function useValidateLabResult() {
  const refresh = useRefreshResult()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: ResultValidationPayload }) => laboratoryMutate<LabResultDetail, ResultValidationPayload>("post", `/laboratory/results/${id}/validate`, payload), onSuccess: refresh })
}

export function useReleaseLabResult() {
  const refresh = useRefreshResult()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: ResultReleasePayload }) => laboratoryMutate<LabResultDetail, ResultReleasePayload>("post", `/laboratory/results/${id}/release`, payload), onSuccess: refresh })
}

export function useSendCriticalAlert() {
  const refresh = useRefreshResult()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: CriticalResultAlertPayload }) => laboratoryMutate<LabResultDetail, CriticalResultAlertPayload>("post", `/laboratory/results/${id}/critical-alert`, payload), onSuccess: refresh })
}
