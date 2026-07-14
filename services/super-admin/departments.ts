"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import { dashboardQueryKeys } from "@/lib/query-keys"
import type { ApiResponse } from "@/types"
import type { SuperAdminDepartmentSummary } from "@/types/super-admin"

export type DepartmentFormPayload = {
  code: string
  name: string
  type: string
  isActive: boolean
}

export function useDepartments() {
  return useQuery({
    queryKey: ["super-admin", "departments"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<SuperAdminDepartmentSummary[]>>(
        "/super-admin/departments"
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Departments could not be loaded")
      }
      return response.data.data
    },
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: DepartmentFormPayload) => {
      const response = await api.post<ApiResponse<SuperAdminDepartmentSummary>>(
        "/super-admin/departments",
        payload
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Department could not be created")
      }
      return response.data.data
    },
    onSuccess: (department) => {
      queryClient.setQueryData<SuperAdminDepartmentSummary[]>(
        ["super-admin", "departments"],
        (current) => current ? [department, ...current.filter((item) => item.id !== department.id)] : current
      )
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.superAdminSummary })
    },
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: DepartmentFormPayload
    }) => {
      const response = await api.patch<ApiResponse<SuperAdminDepartmentSummary>>(
        `/super-admin/departments/${id}`,
        payload
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Department could not be updated")
      }
      return response.data.data
    },
    onSuccess: (department) => {
      queryClient.setQueryData<SuperAdminDepartmentSummary[]>(
        ["super-admin", "departments"],
        (current) => current?.map((item) => item.id === department.id ? department : item)
      )
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.superAdminSummary })
    },
  })
}
