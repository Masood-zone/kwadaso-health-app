"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type {
  ClinicalNotePayload,
  ClinicianDashboardSummary,
  ClinicianEncounterDetail,
  ClinicianEncounterListItem,
  ClinicianFollowUp,
  ClinicianLabRequest,
  ClinicianLabResult,
  ClinicianLookups,
  ClinicianMessageThread,
  ClinicianNotificationItem,
  ClinicianPatientListItem,
  ClinicianPrescription,
  ClinicianReferral,
  ConsultationQueueFilters,
  ConsultationQueueItem,
  DiagnosisPayload,
  EncounterCreatePayload,
  EncounterUpdatePayload,
  FollowUpAppointmentPayload,
  LabRequestPayload,
  PatientClinicalProfile,
  PrescriptionPayload,
  ReferralPayload,
} from "@/types/clinician"

async function getData<T>(path: string) {
  const response = await api.get<ApiResponse<T>>(path)
  if (!response.data.success || response.data.data === undefined) {
    throw new Error(
      response.data.message || "Clinical data could not be loaded."
    )
  }
  return response.data.data
}

async function mutateData<T>(
  method: "post" | "patch" | "delete",
  path: string,
  payload?: unknown
) {
  const response = await api.request<ApiResponse<T>>({
    method,
    url: path,
    data: payload,
  })
  if (!response.data.success || response.data.data === undefined) {
    throw new Error(
      response.data.message || "Clinical action could not be completed."
    )
  }
  return response.data.data
}

function withQuery(path: string, values: Record<string, unknown>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value))
  })
  return `${path}${params.size ? `?${params}` : ""}`
}

function useClinicalMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clinician"] }),
  })
}

export function useClinicianDashboard() {
  return useQuery({
    queryKey: ["clinician", "dashboard"],
    queryFn: () => getData<ClinicianDashboardSummary>("/clinician/dashboard"),
  })
}

export function useClinicianLookups() {
  return useQuery({
    queryKey: ["clinician", "lookups"],
    queryFn: () => getData<ClinicianLookups>("/clinician/lookups"),
  })
}

export function useConsultationQueue(filters: ConsultationQueueFilters = {}) {
  return useQuery({
    queryKey: ["clinician", "consultation-queue", filters],
    queryFn: () =>
      getData<ConsultationQueueItem[]>(
        withQuery("/clinician/consultation-queue", filters)
      ),
  })
}

export function useUpdateConsultationQueue() {
  return useClinicalMutation<
    ConsultationQueueItem,
    { id: string; status: string; notes?: string; cancellationReason?: string }
  >(({ id, ...payload }) =>
    mutateData("patch", `/clinician/consultation-queue/${id}`, payload)
  )
}

export function useClinicianPatients(search = "") {
  return useQuery({
    queryKey: ["clinician", "patients", search],
    queryFn: () =>
      getData<ClinicianPatientListItem[]>(
        withQuery("/clinician/patients", { search })
      ),
  })
}

export function usePatientClinicalProfile(id?: string) {
  return useQuery({
    queryKey: ["clinician", "patient", id],
    enabled: Boolean(id),
    queryFn: () =>
      getData<PatientClinicalProfile>(
        `/clinician/patients/${id}/clinical-profile`
      ),
  })
}

export function useClinicianEncounters(status = "") {
  return useQuery({
    queryKey: ["clinician", "encounters", status],
    queryFn: () =>
      getData<ClinicianEncounterListItem[]>(
        withQuery("/clinician/encounters", { status })
      ),
  })
}

export function useClinicianEncounter(id?: string) {
  return useQuery({
    queryKey: ["clinician", "encounter", id],
    enabled: Boolean(id),
    queryFn: () =>
      getData<ClinicianEncounterDetail>(`/clinician/encounters/${id}`),
  })
}

export function useCreateEncounter() {
  return useClinicalMutation<
    ClinicianEncounterListItem,
    EncounterCreatePayload
  >((payload) => mutateData("post", "/clinician/encounters", payload))
}

export function useUpdateEncounter(id: string) {
  return useClinicalMutation<
    ClinicianEncounterListItem,
    EncounterUpdatePayload
  >((payload) => mutateData("patch", `/clinician/encounters/${id}`, payload))
}

export function useSaveClinicalNote(encounterId: string) {
  return useClinicalMutation<
    unknown,
    { noteId?: string; payload: ClinicalNotePayload }
  >(({ noteId, payload }) =>
    mutateData(
      noteId ? "patch" : "post",
      `/clinician/encounters/${encounterId}/clinical-notes${noteId ? `/${noteId}` : ""}`,
      payload
    )
  )
}

export function useSaveDiagnosis(encounterId: string) {
  return useClinicalMutation<
    unknown,
    { diagnosisId?: string; payload: DiagnosisPayload }
  >(({ diagnosisId, payload }) =>
    mutateData(
      diagnosisId ? "patch" : "post",
      `/clinician/encounters/${encounterId}/diagnoses${diagnosisId ? `/${diagnosisId}` : ""}`,
      payload
    )
  )
}

export function useDeleteDiagnosis(encounterId: string) {
  return useClinicalMutation<{ id: string }, string>((diagnosisId) =>
    mutateData(
      "delete",
      `/clinician/encounters/${encounterId}/diagnoses/${diagnosisId}`
    )
  )
}

export function useClinicianLabRequests() {
  return useQuery({
    queryKey: ["clinician", "lab-requests"],
    queryFn: () => getData<ClinicianLabRequest[]>("/clinician/lab-requests"),
  })
}

export function useClinicianLabResults() {
  return useQuery({
    queryKey: ["clinician", "lab-results"],
    queryFn: () => getData<ClinicianLabResult[]>("/clinician/lab-results"),
  })
}

export function useCreateLabRequest(encounterId: string) {
  return useClinicalMutation<ClinicianLabRequest, LabRequestPayload>(
    (payload) =>
      mutateData(
        "post",
        `/clinician/encounters/${encounterId}/lab-requests`,
        payload
      )
  )
}

export function useClinicianPrescriptions() {
  return useQuery({
    queryKey: ["clinician", "prescriptions"],
    queryFn: () => getData<ClinicianPrescription[]>("/clinician/prescriptions"),
  })
}

export function useCreatePrescription(encounterId: string) {
  return useClinicalMutation<ClinicianPrescription, PrescriptionPayload>(
    (payload) =>
      mutateData(
        "post",
        `/clinician/encounters/${encounterId}/prescriptions`,
        payload
      )
  )
}

export function useClinicianReferrals() {
  return useQuery({
    queryKey: ["clinician", "referrals"],
    queryFn: () => getData<ClinicianReferral[]>("/clinician/referrals"),
  })
}

export function useCreateReferral(encounterId: string) {
  return useClinicalMutation<ClinicianReferral, ReferralPayload>((payload) =>
    mutateData(
      "post",
      `/clinician/encounters/${encounterId}/referrals`,
      payload
    )
  )
}

export function useClinicianFollowUps() {
  return useQuery({
    queryKey: ["clinician", "follow-ups"],
    queryFn: () => getData<ClinicianFollowUp[]>("/clinician/follow-ups"),
  })
}

export function useCreateFollowUp(encounterId: string) {
  return useClinicalMutation<ClinicianFollowUp, FollowUpAppointmentPayload>(
    (payload) =>
      mutateData(
        "post",
        `/clinician/encounters/${encounterId}/follow-up`,
        payload
      )
  )
}

export function useCompleteEncounter(encounterId: string) {
  return useClinicalMutation<
    ClinicianEncounterListItem,
    { acknowledged: true }
  >((payload) =>
    mutateData("post", `/clinician/encounters/${encounterId}/complete`, payload)
  )
}

export function useClinicianMessages() {
  return useQuery({
    queryKey: ["clinician", "messages"],
    queryFn: () => getData<ClinicianMessageThread[]>("/clinician/messages"),
  })
}

export function useSendClinicianMessage() {
  return useClinicalMutation<
    unknown,
    {
      threadId?: string
      subject?: string
      patientId?: string
      encounterId?: string
      priority?: string
      participantIds?: string[]
      body: string
    }
  >((payload) => mutateData("post", "/clinician/messages", payload))
}

export function useClinicianNotifications() {
  return useQuery({
    queryKey: ["clinician", "notifications"],
    queryFn: () =>
      getData<ClinicianNotificationItem[]>("/clinician/notifications"),
  })
}

export function useUpdateClinicianNotification() {
  return useClinicalMutation<
    ClinicianNotificationItem,
    { id: string; status: "READ" | "ARCHIVED" }
  >(({ id, status }) =>
    mutateData("patch", `/clinician/notifications/${id}`, { status })
  )
}
