"use client"

import { useQuery } from "@tanstack/react-query"

import api from "@/lib/axios"
import { dashboardQueryKeys } from "@/lib/query-keys"
import { queryFreshness } from "@/lib/query-client"
import type { ApiResponse } from "@/types"
import type {
  HospitalAdminAppointmentSummaryData,
  HospitalAdminBillingSummaryData,
  HospitalAdminDailyActivityData,
  HospitalAdminDashboardData,
  HospitalAdminDepartmentActivityData,
  HospitalAdminPatientFlowData,
  HospitalAdminReportsData,
} from "@/types/dashboard"

async function getHospitalAdminSection<TData>(path: string) {
  const response = await api.get<ApiResponse<TData>>(path)

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Dashboard could not be loaded")
  }

  return response.data.data
}

export function getHospitalAdminDashboard() {
  return getHospitalAdminSection<HospitalAdminDashboardData>(
    "/hospital-admin/dashboard"
  )
}

export function useHospitalAdminDashboard() {
  return useQuery({
    queryKey: dashboardQueryKeys.hospitalAdmin,
    queryFn: getHospitalAdminDashboard,
    staleTime: queryFreshness.dashboard,
  })
}

export function useHospitalAdminPatientFlow() {
  return useQuery({
    queryKey: ["hospital-admin", "patient-flow"],
    queryFn: () =>
      getHospitalAdminSection<HospitalAdminPatientFlowData>(
        "/hospital-admin/patient-flow"
      ),
  })
}

export function useHospitalAdminDepartmentActivity() {
  return useQuery({
    queryKey: ["hospital-admin", "departments"],
    queryFn: () =>
      getHospitalAdminSection<HospitalAdminDepartmentActivityData>(
        "/hospital-admin/departments"
      ),
  })
}

export function useHospitalAdminAppointmentSummary() {
  return useQuery({
    queryKey: ["hospital-admin", "appointments"],
    queryFn: () =>
      getHospitalAdminSection<HospitalAdminAppointmentSummaryData>(
        "/hospital-admin/appointments"
      ),
  })
}

export function useHospitalAdminBillingSummary() {
  return useQuery({
    queryKey: ["hospital-admin", "billing"],
    queryFn: () =>
      getHospitalAdminSection<HospitalAdminBillingSummaryData>(
        "/hospital-admin/billing"
      ),
  })
}

export function useHospitalAdminReports() {
  return useQuery({
    queryKey: ["hospital-admin", "reports"],
    queryFn: () =>
      getHospitalAdminSection<HospitalAdminReportsData>(
        "/hospital-admin/reports"
      ),
  })
}

export function useHospitalAdminDailyActivity() {
  return useQuery({
    queryKey: ["hospital-admin", "daily-activity"],
    queryFn: () =>
      getHospitalAdminSection<HospitalAdminDailyActivityData>(
        "/hospital-admin/daily-activity"
      ),
  })
}
