"use client"

import { useQuery } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type { SuperAdminDashboardData } from "@/types/dashboard"

export async function getSuperAdminDashboard() {
  const response =
    await api.get<ApiResponse<SuperAdminDashboardData>>("/super-admin/dashboard")

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Dashboard could not be loaded")
  }

  return response.data.data
}

export function useSuperAdminDashboard() {
  return useQuery({
    queryKey: ["super-admin", "dashboard"],
    queryFn: getSuperAdminDashboard,
  })
}
