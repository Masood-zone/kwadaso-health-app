"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import { dashboardQueryKeys } from "@/lib/query-keys"
import { setOptimisticQueryData } from "@/lib/query-cache"
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
    onMutate: async (settings) => {
      const queryKey = ["super-admin", "settings"] as const
      await queryClient.cancelQueries({ queryKey, exact: true })
      return { rollback: setOptimisticQueryData(queryClient, queryKey, settings) }
    },
    onError: (_error, _settings, context) => context?.rollback(),
    onSuccess: (settings) => {
      queryClient.setQueryData(["super-admin", "settings"], settings)
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.superAdminSummary })
    },
  })
}
