"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import { queryFreshness } from "@/lib/query-client"
import type { ApiResponse } from "@/types"
import type {
  HospitalAdminAppointmentCreatePayload,
  HospitalAdminAppointmentFilters,
  HospitalAdminAppointmentListItem,
  HospitalAdminAppointmentUpdatePayload,
  HospitalAdminAuditLogListItem,
  HospitalAdminDepartmentCreatePayload,
  HospitalAdminDepartmentListItem,
  HospitalAdminDepartmentUpdatePayload,
  HospitalAdminEnumLookups,
  HospitalAdminNotificationCreatePayload,
  HospitalAdminNotificationListItem,
  HospitalAdminNotificationUpdatePayload,
  HospitalAdminPatientLookupItem,
  HospitalAdminQueueCreatePayload,
  HospitalAdminQueueFilters,
  HospitalAdminQueueItem,
  HospitalAdminQueueUpdatePayload,
  HospitalAdminReportExportCreatePayload,
  HospitalAdminReportExportListItem,
  HospitalAdminSettingsPayload,
  HospitalAdminStaffCreatePayload,
  HospitalAdminStaffFilters,
  HospitalAdminStaffListItem,
  HospitalAdminStaffUpdatePayload,
} from "@/types/hospital-admin"

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

export function useHospitalAdminLookups() {
  return useQuery({
    queryKey: ["hospital-admin", "lookups"],
    queryFn: () => getData<HospitalAdminEnumLookups>("/hospital-admin/lookups"),
    staleTime: queryFreshness.lookup,
  })
}

export function useHospitalAdminStaff(filters?: HospitalAdminStaffFilters) {
  return useQuery({
    queryKey: ["hospital-admin", "staff", filters],
    queryFn: () =>
      getData<HospitalAdminStaffListItem[]>(
        query("/hospital-admin/staff", filters)
      ),
  })
}

export function useCreateHospitalAdminStaff() {
  const invalidate = useInvalidate(["hospital-admin", "staff"])
  return useMutation({
    mutationFn: (payload: HospitalAdminStaffCreatePayload) =>
      mutateData<HospitalAdminStaffListItem, HospitalAdminStaffCreatePayload>(
        "post",
        "/hospital-admin/staff",
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateHospitalAdminStaff() {
  const invalidate = useInvalidate(["hospital-admin", "staff"])
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: HospitalAdminStaffUpdatePayload
    }) =>
      mutateData<HospitalAdminStaffListItem, HospitalAdminStaffUpdatePayload>(
        "patch",
        `/hospital-admin/staff/${id}`,
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useHospitalAdminDepartments(filters?: { search?: string }) {
  return useQuery({
    queryKey: ["hospital-admin", "departments", filters],
    queryFn: () =>
      getData<HospitalAdminDepartmentListItem[]>(
        query("/hospital-admin/departments", filters)
      ),
  })
}

export function useCreateHospitalAdminDepartment() {
  const invalidate = useInvalidate(["hospital-admin", "departments"])
  return useMutation({
    mutationFn: (payload: HospitalAdminDepartmentCreatePayload) =>
      mutateData<
        HospitalAdminDepartmentListItem,
        HospitalAdminDepartmentCreatePayload
      >("post", "/hospital-admin/departments", payload),
    onSuccess: invalidate,
  })
}

export function useUpdateHospitalAdminDepartment() {
  const invalidate = useInvalidate(["hospital-admin", "departments"])
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: HospitalAdminDepartmentUpdatePayload
    }) =>
      mutateData<
        HospitalAdminDepartmentListItem,
        HospitalAdminDepartmentUpdatePayload
      >("patch", `/hospital-admin/departments/${id}`, payload),
    onSuccess: invalidate,
  })
}

export function useHospitalAdminSettings() {
  return useQuery({
    queryKey: ["hospital-admin", "settings"],
    queryFn: () =>
      getData<HospitalAdminSettingsPayload>("/hospital-admin/settings"),
  })
}

export function useUpdateHospitalAdminSettings() {
  const invalidate = useInvalidate(["hospital-admin", "settings"])
  return useMutation({
    mutationFn: (payload: HospitalAdminSettingsPayload) =>
      mutateData<HospitalAdminSettingsPayload, HospitalAdminSettingsPayload>(
        "patch",
        "/hospital-admin/settings",
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useHospitalAdminAppointments(
  filters?: HospitalAdminAppointmentFilters
) {
  return useQuery({
    queryKey: ["hospital-admin", "appointments", filters],
    queryFn: () =>
      getData<HospitalAdminAppointmentListItem[]>(
        query("/hospital-admin/appointments", filters)
      ),
  })
}

export function useHospitalAdminPatientLookup(search?: string) {
  return useQuery({
    queryKey: ["hospital-admin", "patients", search],
    queryFn: () =>
      getData<HospitalAdminPatientLookupItem[]>(
        query("/hospital-admin/patients", { search })
      ),
  })
}

export function useCreateHospitalAdminAppointment() {
  const invalidate = useInvalidate(["hospital-admin", "appointments"])
  return useMutation({
    mutationFn: (payload: HospitalAdminAppointmentCreatePayload) =>
      mutateData<
        HospitalAdminAppointmentListItem,
        HospitalAdminAppointmentCreatePayload
      >("post", "/hospital-admin/appointments", payload),
    onSuccess: invalidate,
  })
}

export function useUpdateHospitalAdminAppointment() {
  const invalidate = useInvalidate(["hospital-admin", "appointments"])
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: HospitalAdminAppointmentUpdatePayload
    }) =>
      mutateData<
        HospitalAdminAppointmentListItem,
        HospitalAdminAppointmentUpdatePayload
      >("patch", `/hospital-admin/appointments/${id}`, payload),
    onSuccess: invalidate,
  })
}

export function useHospitalAdminQueue(filters?: HospitalAdminQueueFilters) {
  return useQuery({
    queryKey: ["hospital-admin", "queue", filters],
    queryFn: () =>
      getData<HospitalAdminQueueItem[]>(
        query("/hospital-admin/queue", filters)
      ),
    staleTime: queryFreshness.live,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

export function useCreateHospitalAdminQueueItem() {
  const invalidate = useInvalidate(["hospital-admin", "queue"])
  return useMutation({
    mutationFn: (payload: HospitalAdminQueueCreatePayload) =>
      mutateData<HospitalAdminQueueItem, HospitalAdminQueueCreatePayload>(
        "post",
        "/hospital-admin/queue",
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateHospitalAdminQueueItem() {
  const invalidate = useInvalidate(["hospital-admin", "queue"])
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: HospitalAdminQueueUpdatePayload
    }) =>
      mutateData<HospitalAdminQueueItem, HospitalAdminQueueUpdatePayload>(
        "patch",
        `/hospital-admin/queue/${id}`,
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useHospitalAdminReportExports(filters?: {
  type?: string
  createdBy?: string
  dateFrom?: string
  dateTo?: string
}) {
  return useQuery({
    queryKey: ["hospital-admin", "reports", filters],
    queryFn: () =>
      getData<HospitalAdminReportExportListItem[]>(
        query("/hospital-admin/reports/exports", filters)
      ),
  })
}

export function useCreateHospitalAdminReportExport() {
  const invalidate = useInvalidate(["hospital-admin", "reports"])
  return useMutation({
    mutationFn: (payload: HospitalAdminReportExportCreatePayload) =>
      mutateData<
        HospitalAdminReportExportListItem,
        HospitalAdminReportExportCreatePayload
      >("post", "/hospital-admin/reports/exports", payload),
    onSuccess: invalidate,
  })
}

export function useHospitalAdminNotifications(filters?: {
  status?: string
  priority?: string
  targetRole?: string
  createdBy?: string
}) {
  return useQuery({
    queryKey: ["hospital-admin", "notifications", filters],
    queryFn: () =>
      getData<HospitalAdminNotificationListItem[]>(
        query("/hospital-admin/notifications", filters)
      ),
  })
}

export function useCreateHospitalAdminNotification() {
  const invalidate = useInvalidate(["hospital-admin", "notifications"])
  return useMutation({
    mutationFn: (payload: HospitalAdminNotificationCreatePayload) =>
      mutateData<
        HospitalAdminNotificationListItem,
        HospitalAdminNotificationCreatePayload
      >("post", "/hospital-admin/notifications", payload),
    onSuccess: invalidate,
  })
}

export function useUpdateHospitalAdminNotification() {
  const invalidate = useInvalidate(["hospital-admin", "notifications"])
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: HospitalAdminNotificationUpdatePayload
    }) =>
      mutateData<
        HospitalAdminNotificationListItem,
        HospitalAdminNotificationUpdatePayload
      >("patch", `/hospital-admin/notifications/${id}`, payload),
    onSuccess: invalidate,
  })
}

export function useHospitalAdminAuditLogs(filters?: {
  actorId?: string
  action?: string
  entityType?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}) {
  return useQuery({
    queryKey: ["hospital-admin", "audit-logs", filters],
    queryFn: () =>
      getData<HospitalAdminAuditLogListItem[]>(
        query("/hospital-admin/audit-logs", filters)
      ),
  })
}

export type HospitalAdminOversightData = {
  billing: { invoices: number; payments: number }
  referrals: { total: number }
  clinical: { encounters: number; diagnoses: number }
  laboratory: { requests: number; results: number }
  pharmacy: { stockBatches: number; lowStock: number }
  sync: { status: string; count: number }[]
}

export function useHospitalAdminOversight() {
  return useQuery({
    queryKey: ["hospital-admin", "oversight"],
    queryFn: () =>
      getData<HospitalAdminOversightData>("/hospital-admin/oversight"),
  })
}
