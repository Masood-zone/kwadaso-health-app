"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type {
  NurseDashboardSummary,
  NurseEmergencyFlagPayload,
  NurseImmunizationCreatePayload,
  NurseImmunizationFilters,
  NurseImmunizationListItem,
  NurseImmunizationUpdatePayload,
  NurseLookups,
  NurseNotificationItem,
  NurseNotificationUpdatePayload,
  NurseQueueUpdatePayload,
  NurseTriageQueueFilters,
  NurseTriageQueueItem,
  NurseVitalSignsCreatePayload,
  NurseVitalSignsListItem,
  NurseVitalSignsUpdatePayload,
  PatientTriageProfile,
} from "@/types/nurse"

async function getData<TData>(path: string) {
  const response = await api.get<ApiResponse<TData>>(path)
  if (!response.data.success || response.data.data === undefined) {
    throw new Error(response.data.message || "Request could not be loaded")
  }
  return response.data.data
}

async function mutateData<TData, TPayload>(
  method: "post" | "patch",
  path: string,
  payload: TPayload
) {
  const response = await api[method]<ApiResponse<TData>>(path, payload)
  if (!response.data.success || response.data.data === undefined) {
    throw new Error(response.data.message || "Request could not be saved")
  }
  return response.data.data
}

function query(path: string, params: Record<string, unknown> = {}) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, String(value))
  }
  return `${path}${searchParams.size ? `?${searchParams.toString()}` : ""}`
}

export function useNurseLookups() {
  return useQuery({
    queryKey: ["nurse", "lookups"],
    queryFn: () => getData<NurseLookups>("/nurse/lookups"),
  })
}

export function useNurseDashboard() {
  return useQuery({
    queryKey: ["nurse", "dashboard"],
    queryFn: () => getData<NurseDashboardSummary>("/nurse/dashboard"),
  })
}

export function useNurseTriageQueue(filters?: NurseTriageQueueFilters) {
  return useQuery({
    queryKey: ["nurse", "triage-queue", filters],
    queryFn: () =>
      getData<NurseTriageQueueItem[]>(
        query("/nurse/triage-queue", filters)
      ),
  })
}

export function useUpdateNurseQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: NurseQueueUpdatePayload }) =>
      mutateData<NurseTriageQueueItem, NurseQueueUpdatePayload>(
        "patch",
        `/nurse/triage-queue/${id}`,
        payload
      ),
    onSuccess: (queue) => {
      queryClient.invalidateQueries({ queryKey: ["nurse", "triage-queue"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "queue-board"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "patient", queue.patientId] })
    },
  })
}

export function useEmergencyFlag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: NurseEmergencyFlagPayload }) =>
      mutateData<NurseTriageQueueItem, NurseEmergencyFlagPayload>(
        "post",
        `/nurse/triage-queue/${id}/emergency-flag`,
        payload
      ),
    onSuccess: (queue) => {
      queryClient.invalidateQueries({ queryKey: ["nurse", "triage-queue"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "notifications"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "patient", queue.patientId] })
    },
  })
}

export function usePatientTriageProfile(id?: string) {
  return useQuery({
    queryKey: ["nurse", "patient", id],
    enabled: Boolean(id),
    queryFn: () =>
      getData<PatientTriageProfile>(`/nurse/patients/${id}/triage-profile`),
  })
}

export function useNurseVitals(patientId?: string) {
  return useQuery({
    queryKey: ["nurse", "vitals", patientId],
    enabled: Boolean(patientId),
    queryFn: () =>
      getData<NurseVitalSignsListItem[]>(`/nurse/patients/${patientId}/vitals`),
  })
}

export function useCreateNurseVitals(patientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: NurseVitalSignsCreatePayload) =>
      mutateData<NurseVitalSignsListItem, NurseVitalSignsCreatePayload>(
        "post",
        `/nurse/patients/${patientId}/vitals`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nurse", "vitals", patientId] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "triage-queue"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "patient", patientId] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "dashboard"] })
    },
  })
}

export function useUpdateNurseVitals(patientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      vitalId,
      payload,
    }: {
      vitalId: string
      payload: NurseVitalSignsUpdatePayload
    }) =>
      mutateData<NurseVitalSignsListItem, NurseVitalSignsUpdatePayload>(
        "patch",
        `/nurse/patients/${patientId}/vitals/${vitalId}`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nurse", "vitals", patientId] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "patient", patientId] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "triage-queue"] })
    },
  })
}

export function useNurseImmunizations(filters?: NurseImmunizationFilters) {
  return useQuery({
    queryKey: ["nurse", "immunizations", filters],
    queryFn: () =>
      getData<NurseImmunizationListItem[]>(
        query("/nurse/immunizations", filters)
      ),
  })
}

export function useCreateNurseImmunization(patientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: NurseImmunizationCreatePayload) =>
      mutateData<NurseImmunizationListItem, NurseImmunizationCreatePayload>(
        "post",
        `/nurse/patients/${patientId}/immunizations`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nurse", "immunizations"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "patient", patientId] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "dashboard"] })
    },
  })
}

export function useUpdateNurseImmunization(patientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      immunizationId,
      payload,
    }: {
      immunizationId: string
      payload: NurseImmunizationUpdatePayload
    }) =>
      mutateData<NurseImmunizationListItem, NurseImmunizationUpdatePayload>(
        "patch",
        `/nurse/patients/${patientId}/immunizations/${immunizationId}`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nurse", "immunizations"] })
      queryClient.invalidateQueries({ queryKey: ["nurse", "patient", patientId] })
    },
  })
}

export function useNurseNotifications() {
  return useQuery({
    queryKey: ["nurse", "notifications"],
    queryFn: () => getData<NurseNotificationItem[]>("/nurse/notifications"),
  })
}

export function useUpdateNurseNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: NurseNotificationUpdatePayload }) =>
      mutateData<NurseNotificationItem, NurseNotificationUpdatePayload>(
        "patch",
        `/nurse/notifications/${id}`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nurse", "notifications"] })
    },
  })
}
