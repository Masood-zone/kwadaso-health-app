"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type { SuperAdminStaffSummary } from "@/types/super-admin"

export type StaffFormPayload = {
  firstName: string
  lastName: string
  otherNames?: string | null
  email: string
  phone?: string | null
  jobTitle?: string | null
  departmentId?: string | null
  defaultRole: string
  status: string
  temporaryPassword?: string
}

export function useStaffList(filters?: {
  search?: string
  status?: string
  role?: string
}) {
  return useQuery({
    queryKey: ["super-admin", "staff", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.search) params.set("search", filters.search)
      if (filters?.status) params.set("status", filters.status)
      if (filters?.role) params.set("role", filters.role)

      const response = await api.get<ApiResponse<SuperAdminStaffSummary[]>>(
        `/super-admin/staff${params.size ? `?${params.toString()}` : ""}`
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(
          response.data.message || "Staff accounts could not be loaded"
        )
      }
      return response.data.data
    },
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StaffFormPayload) => {
      const response = await api.post<ApiResponse<SuperAdminStaffSummary>>(
        "/super-admin/staff",
        payload
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(
          response.data.message || "Staff account could not be created"
        )
      }
      return response.data.data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["super-admin"] }),
  })
}

export function useUpdateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: StaffFormPayload
    }) => {
      const { temporaryPassword, ...updatePayload } = payload
      void temporaryPassword
      const response = await api.patch<ApiResponse<SuperAdminStaffSummary>>(
        `/super-admin/staff/${id}`,
        updatePayload
      )
      if (!response.data.success || !response.data.data) {
        throw new Error(
          response.data.message || "Staff account could not be updated"
        )
      }
      return response.data.data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["super-admin"] }),
  })
}
