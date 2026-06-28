"use client"

import { useQuery } from "@tanstack/react-query"

import api from "@/lib/axios"
import type { PaginatedResponse } from "@/types"
import type { SuperAdminAuditLogItem } from "@/types/super-admin"

export function useAuditLogs(page: number, filters: Record<string, string>) {
  return useQuery({
    queryKey: ["super-admin", "audit-logs", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" })
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value)
      }
      const response = await api.get<PaginatedResponse<SuperAdminAuditLogItem>>(
        `/super-admin/audit-logs?${params.toString()}`
      )
      if (!response.data.success) {
        throw new Error(response.data.message || "Audit logs could not be loaded")
      }
      return response.data
    },
  })
}
