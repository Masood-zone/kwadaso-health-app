"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import { toApiClientError } from "@/lib/api-client-error"
import type { ApiResponse } from "@/types"
import type {
  DispensingCreatePayload,
  DispensingListItem,
  MedicationCatalogItem,
  MedicationCreatePayload,
  MedicationStockItem,
  MedicationUpdatePayload,
  PharmacyDashboardSummary,
  PharmacyNotificationItem,
  PharmacyPage,
  PharmacyReportFilters,
  PrescriptionDetail,
  PrescriptionFilters,
  PrescriptionQueueItem,
  StockCreatePayload,
  StockMovementItem,
  StockMovementPayload,
  StockUpdatePayload,
} from "@/types/pharmacy"

async function getData<T>(path: string) {
  try {
    const response = await api.get<ApiResponse<T>>(path)
    if (!response.data.success || response.data.data === undefined)
      throw new Error(
        response.data.message || "Pharmacy data could not be loaded"
      )
    return response.data.data
  } catch (error) {
    throw toApiClientError(error, "Pharmacy data could not be loaded")
  }
}

async function mutateData<T, P>(
  method: "post" | "patch",
  path: string,
  payload: P
) {
  try {
    const response = await api[method]<ApiResponse<T>>(path, payload)
    if (!response.data.success || response.data.data === undefined)
      throw new Error(
        response.data.message || "Pharmacy update could not be saved"
      )
    return response.data.data
  } catch (error) {
    throw toApiClientError(error, "Pharmacy update could not be saved")
  }
}

function withQuery(path: string, filters: Record<string, unknown> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value))
  return params.size ? `${path}?${params}` : path
}

function usePharmacyInvalidation() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ["pharmacy"] })
}

export function usePharmacyDashboard() {
  return useQuery({
    queryKey: ["pharmacy", "dashboard"],
    queryFn: () => getData<PharmacyDashboardSummary>("/pharmacy/dashboard"),
  })
}
export function usePharmacyLookups() {
  return useQuery({
    queryKey: ["pharmacy", "lookups"],
    queryFn: () =>
      getData<Record<string, Array<Record<string, unknown>>>>(
        "/pharmacy/lookups"
      ),
    staleTime: 300000,
  })
}
export function usePharmacyPrescriptions(filters: PrescriptionFilters = {}) {
  return useQuery({
    queryKey: ["pharmacy", "prescriptions", filters],
    queryFn: () =>
      getData<PharmacyPage<PrescriptionQueueItem>>(
        withQuery("/pharmacy/prescriptions", filters)
      ),
  })
}
export function usePharmacyPrescription(id?: string) {
  return useQuery({
    queryKey: ["pharmacy", "prescription", id],
    queryFn: () => getData<PrescriptionDetail>(`/pharmacy/prescriptions/${id}`),
    enabled: Boolean(id),
  })
}
export function useCancelPrescription(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (cancellationReason: string) =>
      mutateData<
        PrescriptionDetail,
        { status: "CANCELLED"; cancellationReason: string }
      >("patch", `/pharmacy/prescriptions/${id}`, {
        status: "CANCELLED",
        cancellationReason,
      }),
    onSuccess: invalidate,
  })
}
export function useReleasePrescriptionExternally(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (reason: string) =>
      mutateData<PrescriptionDetail, { reason: string }>(
        "post",
        `/pharmacy/prescriptions/${id}/external-release`,
        { reason }
      ),
    onSuccess: invalidate,
  })
}
export function useDispensePrescription(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: DispensingCreatePayload) =>
      mutateData<Record<string, unknown>, DispensingCreatePayload>(
        "post",
        `/pharmacy/prescriptions/${id}/dispense`,
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useDispensing(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["pharmacy", "dispensing", filters],
    queryFn: () =>
      getData<PharmacyPage<DispensingListItem>>(
        withQuery("/pharmacy/dispensing", filters)
      ),
  })
}
export function useDispensingDetail(id?: string) {
  return useQuery({
    queryKey: ["pharmacy", "dispensing", id],
    queryFn: () =>
      getData<Record<string, unknown>>(`/pharmacy/dispensing/${id}`),
    enabled: Boolean(id),
  })
}

export function useMedications(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["pharmacy", "medications", filters],
    queryFn: () =>
      getData<PharmacyPage<MedicationCatalogItem>>(
        withQuery("/pharmacy/medications", filters)
      ),
  })
}
export function useCreateMedication() {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: MedicationCreatePayload) =>
      mutateData<MedicationCatalogItem, MedicationCreatePayload>(
        "post",
        "/pharmacy/medications",
        payload
      ),
    onSuccess: invalidate,
  })
}
export function useUpdateMedication(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: MedicationUpdatePayload) =>
      mutateData<MedicationCatalogItem, MedicationUpdatePayload>(
        "patch",
        `/pharmacy/medications/${id}`,
        payload
      ),
    onSuccess: invalidate,
  })
}

export function useStock(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["pharmacy", "stock", filters],
    queryFn: () =>
      getData<PharmacyPage<MedicationStockItem>>(
        withQuery("/pharmacy/stock", filters)
      ),
  })
}
export function useStockDetail(id?: string) {
  return useQuery({
    queryKey: ["pharmacy", "stock", id],
    queryFn: () => getData<Record<string, unknown>>(`/pharmacy/stock/${id}`),
    enabled: Boolean(id),
  })
}
export function useCreateStock() {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: StockCreatePayload) =>
      mutateData<MedicationStockItem, StockCreatePayload>(
        "post",
        "/pharmacy/stock",
        payload
      ),
    onSuccess: invalidate,
  })
}
export function useUpdateStock(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: StockUpdatePayload) =>
      mutateData<MedicationStockItem, StockUpdatePayload>(
        "patch",
        `/pharmacy/stock/${id}`,
        payload
      ),
    onSuccess: invalidate,
  })
}
export function useCreateMovement(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: StockMovementPayload) =>
      mutateData<Record<string, unknown>, StockMovementPayload>(
        "post",
        `/pharmacy/stock/${id}/movements`,
        payload
      ),
    onSuccess: invalidate,
  })
}
export function useWriteOffStock(id: string, kind: "expired" | "damaged") {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: {
      quantity: number
      reason: string
      reference?: string | null
    }) =>
      mutateData<Record<string, unknown>, typeof payload>(
        "post",
        `/pharmacy/stock/${id}/mark-${kind}`,
        payload
      ),
    onSuccess: invalidate,
  })
}
export function useStockMovements(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["pharmacy", "stock-movements", filters],
    queryFn: () =>
      getData<PharmacyPage<StockMovementItem>>(
        withQuery("/pharmacy/stock-movements", filters)
      ),
  })
}
export function useLowStock() {
  return useQuery({
    queryKey: ["pharmacy", "low-stock"],
    queryFn: () =>
      getData<
        Array<
          MedicationStockItem & {
            shortageAmount: number
            recommendedQuantity: number
            activeReorder: Record<string, unknown> | null
          }
        >
      >("/pharmacy/low-stock"),
  })
}
export function useExpiredStock() {
  return useQuery({
    queryKey: ["pharmacy", "expired"],
    queryFn: () =>
      getData<
        Array<
          MedicationStockItem & { expiryStatus: string; disposalStatus: string }
        >
      >("/pharmacy/expired"),
  })
}
export function useCreateReorder(stockId: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: {
      requestedQuantity: number
      notes?: string | null
    }) =>
      mutateData<Record<string, unknown>, typeof payload>(
        "post",
        `/pharmacy/low-stock/${stockId}/reorders`,
        payload
      ),
    onSuccess: invalidate,
  })
}
export function useUpdateReorder(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: {
      status: "REQUESTED" | "ORDERED" | "RECEIVED" | "CANCELLED"
      notes?: string | null
    }) =>
      mutateData<Record<string, unknown>, typeof payload>(
        "patch",
        `/pharmacy/reorders/${id}`,
        payload
      ),
    onSuccess: invalidate,
  })
}

export function usePharmacyPatients(search = "") {
  return useQuery({
    queryKey: ["pharmacy", "patients", search],
    queryFn: () =>
      getData<Array<Record<string, unknown>>>(
        withQuery("/pharmacy/patients", { search })
      ),
  })
}
export function usePatientMedicationHistory(id?: string) {
  return useQuery({
    queryKey: ["pharmacy", "patient-history", id],
    queryFn: () =>
      getData<Record<string, unknown>>(
        `/pharmacy/patients/${id}/medication-history`
      ),
    enabled: Boolean(id),
  })
}
export function usePharmacyReports(filters: PharmacyReportFilters = {}) {
  return useQuery({
    queryKey: ["pharmacy", "reports", filters],
    queryFn: () =>
      getData<Record<string, unknown>>(withQuery("/pharmacy/reports", filters)),
  })
}
export function useExportPharmacyReport() {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (payload: PharmacyReportFilters & { type?: string }) =>
      mutateData<Record<string, unknown>, typeof payload>(
        "post",
        "/pharmacy/reports/exports",
        payload
      ),
    onSuccess: invalidate,
  })
}
export function usePharmacyNotifications(
  filters: Record<string, unknown> = {}
) {
  return useQuery({
    queryKey: ["pharmacy", "notifications", filters],
    queryFn: () =>
      getData<PharmacyPage<PharmacyNotificationItem>>(
        withQuery("/pharmacy/notifications", filters)
      ),
  })
}
export function useUpdatePharmacyNotification(id: string) {
  const invalidate = usePharmacyInvalidation()
  return useMutation({
    mutationFn: (status: "READ" | "ARCHIVED") =>
      mutateData<PharmacyNotificationItem, { status: "READ" | "ARCHIVED" }>(
        "patch",
        `/pharmacy/notifications/${id}`,
        { status }
      ),
    onSuccess: invalidate,
  })
}
