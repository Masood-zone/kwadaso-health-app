"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type { SuperAdminSettingsData } from "@/types/super-admin"

export function useSettings() {
  return useQuery({
    queryKey: ["super-admin", "settings"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<SuperAdminSettingsData>>(
        "/super-admin/settings"
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Settings could not be loaded")
      }
      return response.data.data
    },
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SuperAdminSettingsData) => {
      const response = await api.patch<ApiResponse<SuperAdminSettingsData>>(
        "/super-admin/settings",
        {
          facility: payload.facility,
          system: payload.system,
        }
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Settings could not be updated")
      }
      return response.data.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin"] }),
  })
}
