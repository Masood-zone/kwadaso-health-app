"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type {
  RecordsOfficerAppointmentCreatePayload,
  RecordsOfficerAppointmentFilters,
  RecordsOfficerAppointmentListItem,
  RecordsOfficerAppointmentUpdatePayload,
  RecordsOfficerCheckInPayload,
  RecordsOfficerDashboardSummary,
  RecordsOfficerDuplicatePatientMatch,
  RecordsOfficerLookups,
  RecordsOfficerPatientCreatePayload,
  RecordsOfficerPatientDocumentListItem,
  RecordsOfficerPatientDocumentPayload,
  RecordsOfficerPatientFilters,
  RecordsOfficerPatientListItem,
  RecordsOfficerPatientProfile,
  RecordsOfficerPatientUpdatePayload,
  RecordsOfficerPrintExportPayload,
  RecordsOfficerPrintExportResponse,
  RecordsOfficerQueueCreatePayload,
  RecordsOfficerQueueFilters,
  RecordsOfficerQueueListItem,
  RecordsOfficerQueueUpdatePayload,
  RecordsOfficerTimelineItem,
  RecordsOfficerVisitHistoryItem,
} from "@/types/records-officer"

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

function useInvalidate(key: readonly unknown[]) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: key })
}

export function useRecordsOfficerLookups() {
  return useQuery({
    queryKey: ["records-officer", "lookups"],
    queryFn: () => getData<RecordsOfficerLookups>("/records-officer/lookups"),
  })
}

export function useRecordsOfficerDashboard() {
  return useQuery({
    queryKey: ["records-officer", "dashboard"],
    queryFn: () =>
      getData<RecordsOfficerDashboardSummary>("/records-officer/dashboard"),
  })
}

export function useRecordsOfficerPatients(filters?: RecordsOfficerPatientFilters) {
  return useQuery({
    queryKey: ["records-officer", "patients", filters],
    queryFn: () =>
      getData<RecordsOfficerPatientListItem[]>(
        query("/records-officer/patients", filters)
      ),
  })
}

export function useRecordsOfficerPatient(id?: string) {
  return useQuery({
    queryKey: ["records-officer", "patient", id],
    enabled: Boolean(id),
    queryFn: () =>
      getData<RecordsOfficerPatientProfile>(`/records-officer/patients/${id}`),
  })
}

export function useCreateRecordsOfficerPatient() {
  const invalidate = useInvalidate(["records-officer", "patients"])
  return useMutation({
    mutationFn: (payload: RecordsOfficerPatientCreatePayload) =>
      mutateData<RecordsOfficerPatientListItem, RecordsOfficerPatientCreatePayload>(
        "post",
        "/records-officer/patients",
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateRecordsOfficerPatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecordsOfficerPatientUpdatePayload }) =>
      mutateData<RecordsOfficerPatientListItem, RecordsOfficerPatientUpdatePayload>(
        "patch",
        `/records-officer/patients/${id}`,
        payload
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["records-officer", "patients"] })
      queryClient.invalidateQueries({ queryKey: ["records-officer", "patient", variables.id] })
    },
  })
}

export function useRecordsOfficerDuplicates(search?: string) {
  return useQuery({
    queryKey: ["records-officer", "duplicates", search],
    queryFn: () =>
      getData<RecordsOfficerDuplicatePatientMatch[]>(
        query("/records-officer/patients/duplicates", { search })
      ),
  })
}

export function useRecordsOfficerDocuments(patientId?: string) {
  return useQuery({
    queryKey: ["records-officer", "documents", patientId],
    enabled: Boolean(patientId),
    queryFn: () =>
      getData<RecordsOfficerPatientDocumentListItem[]>(
        `/records-officer/patients/${patientId}/documents`
      ),
  })
}

export function useCreateRecordsOfficerDocument(patientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecordsOfficerPatientDocumentPayload) =>
      mutateData<RecordsOfficerPatientDocumentListItem, RecordsOfficerPatientDocumentPayload>(
        "post",
        `/records-officer/patients/${patientId}/documents`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records-officer", "documents", patientId] })
      queryClient.invalidateQueries({ queryKey: ["records-officer", "patient", patientId] })
    },
  })
}

export function useUpdateRecordsOfficerDocument(patientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, payload }: { documentId: string; payload: RecordsOfficerPatientDocumentPayload }) =>
      mutateData<RecordsOfficerPatientDocumentListItem, RecordsOfficerPatientDocumentPayload>(
        "patch",
        `/records-officer/patients/${patientId}/documents/${documentId}`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records-officer", "documents", patientId] })
      queryClient.invalidateQueries({ queryKey: ["records-officer", "patient", patientId] })
    },
  })
}

export function useRecordsOfficerAppointments(filters?: RecordsOfficerAppointmentFilters) {
  return useQuery({
    queryKey: ["records-officer", "appointments", filters],
    queryFn: () =>
      getData<RecordsOfficerAppointmentListItem[]>(
        query("/records-officer/appointments", filters)
      ),
  })
}

export function useCreateRecordsOfficerAppointment() {
  const invalidate = useInvalidate(["records-officer", "appointments"])
  return useMutation({
    mutationFn: (payload: RecordsOfficerAppointmentCreatePayload) =>
      mutateData<RecordsOfficerAppointmentListItem, RecordsOfficerAppointmentCreatePayload>(
        "post",
        "/records-officer/appointments",
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateRecordsOfficerAppointment() {
  const invalidate = useInvalidate(["records-officer", "appointments"])
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecordsOfficerAppointmentUpdatePayload }) =>
      mutateData<RecordsOfficerAppointmentListItem, RecordsOfficerAppointmentUpdatePayload>(
        "patch",
        `/records-officer/appointments/${id}`,
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useRecordsOfficerQueue(filters?: RecordsOfficerQueueFilters) {
  return useQuery({
    queryKey: ["records-officer", "queue", filters],
    queryFn: () =>
      getData<RecordsOfficerQueueListItem[]>(query("/records-officer/queue", filters)),
  })
}

export function useCreateRecordsOfficerQueue() {
  const invalidate = useInvalidate(["records-officer", "queue"])
  return useMutation({
    mutationFn: (payload: RecordsOfficerQueueCreatePayload) =>
      mutateData<RecordsOfficerQueueListItem, RecordsOfficerQueueCreatePayload>(
        "post",
        "/records-officer/queue",
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateRecordsOfficerQueue() {
  const invalidate = useInvalidate(["records-officer", "queue"])
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecordsOfficerQueueUpdatePayload }) =>
      mutateData<RecordsOfficerQueueListItem, RecordsOfficerQueueUpdatePayload>(
        "patch",
        `/records-officer/queue/${id}`,
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useRecordsOfficerCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecordsOfficerCheckInPayload) =>
      mutateData<RecordsOfficerQueueListItem, RecordsOfficerCheckInPayload>(
        "post",
        "/records-officer/check-in",
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records-officer", "queue"] })
      queryClient.invalidateQueries({ queryKey: ["records-officer", "appointments"] })
    },
  })
}

export function useRecordsOfficerVisitHistory(patientId?: string) {
  return useQuery({
    queryKey: ["records-officer", "visit-history", patientId],
    enabled: Boolean(patientId),
    queryFn: () =>
      getData<RecordsOfficerVisitHistoryItem[]>(
        `/records-officer/patients/${patientId}/visit-history`
      ),
  })
}

export function useRecordsOfficerTimeline(patientId?: string) {
  return useQuery({
    queryKey: ["records-officer", "timeline", patientId],
    enabled: Boolean(patientId),
    queryFn: () =>
      getData<RecordsOfficerTimelineItem[]>(
        `/records-officer/patients/${patientId}/timeline`
      ),
  })
}

export function useRecordsOfficerPrintExport(patientId: string) {
  return useMutation({
    mutationFn: (payload: RecordsOfficerPrintExportPayload) =>
      mutateData<RecordsOfficerPrintExportResponse, RecordsOfficerPrintExportPayload>(
        "post",
        `/records-officer/patients/${patientId}/print-summary`,
        payload
      ),
  })
}
