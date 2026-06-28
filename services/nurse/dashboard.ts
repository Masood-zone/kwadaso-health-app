"use client"

import { useQuery } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type { NurseDashboardSummary } from "@/types/nurse"

export async function getNurseDashboard() {
  const response = await api.get<ApiResponse<NurseDashboardSummary>>(
    "/nurse/dashboard"
  )

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Dashboard could not be loaded")
  }

  return response.data.data
}

export function useNurseDashboard() {
  return useQuery({
    queryKey: ["nurse", "dashboard"],
    queryFn: getNurseDashboard,
  })
}
