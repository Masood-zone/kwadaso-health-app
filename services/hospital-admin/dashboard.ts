"use client"

import { useQuery } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type { HospitalAdminDashboardData } from "@/types/dashboard"

export async function getHospitalAdminDashboard() {
  const response =
    await api.get<ApiResponse<HospitalAdminDashboardData>>(
      "/hospital-admin/dashboard"
    )

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Dashboard could not be loaded")
  }

  return response.data.data
}

export function useHospitalAdminDashboard() {
  return useQuery({
    queryKey: ["hospital-admin", "dashboard"],
    queryFn: getHospitalAdminDashboard,
  })
}
