"use client"

import { useQuery } from "@tanstack/react-query"

import api from "@/lib/axios"
import { dashboardQueryKeys } from "@/lib/query-keys"
import { queryFreshness } from "@/lib/query-client"
import type { ApiResponse } from "@/types"
import type {
  SuperAdminDashboardData,
  SuperAdminDashboardSummary,
} from "@/types/dashboard"

export async function getSuperAdminDashboard() {
  const response = await api.get<ApiResponse<SuperAdminDashboardData>>(
    "/super-admin/dashboard"
  )

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Dashboard could not be loaded")
  }

  return response.data.data
}

export function useSuperAdminDashboard() {
  return useQuery({
    queryKey: dashboardQueryKeys.superAdmin,
    queryFn: getSuperAdminDashboard,
    staleTime: queryFreshness.dashboard,
  })
}

export async function getSuperAdminDashboardSummary() {
  const response = await api.get<ApiResponse<SuperAdminDashboardSummary>>(
    "/super-admin/dashboard/summary"
  )
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Dashboard could not be loaded")
  }
  return response.data.data
}

export function useSuperAdminDashboardSummary() {
  return useQuery({
    queryKey: dashboardQueryKeys.superAdminSummary,
    queryFn: getSuperAdminDashboardSummary,
    staleTime: queryFreshness.dashboard,
  })
}
