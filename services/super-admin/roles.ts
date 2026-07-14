"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import { dashboardQueryKeys } from "@/lib/query-keys"
import type { ApiResponse } from "@/types"
import type {
  SuperAdminPermission,
  SuperAdminRoleMatrix,
} from "@/types/super-admin"

export type RolePermissionMatrixData = {
  permissions: SuperAdminPermission[]
  roles: SuperAdminRoleMatrix[]
}

export function useRolePermissionMatrix() {
  return useQuery({
    queryKey: ["super-admin", "roles"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RolePermissionMatrixData>>(
        "/super-admin/roles"
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Role permissions could not be loaded")
      }
      return response.data.data
    },
  })
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { roleId: string; permissionKeys: string[] }) => {
      const response = await api.patch<ApiResponse<RolePermissionMatrixData>>(
        "/super-admin/roles",
        payload
      )
      if (!response.data.success) {
        throw new Error(response.data.message || "Role permissions could not be updated")
      }
      return response.data.data
    },
    onSuccess: (matrix) => {
      if (matrix) queryClient.setQueryData(["super-admin", "roles"], matrix)
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.superAdmin })
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.superAdminSummary })
    },
  })
}
