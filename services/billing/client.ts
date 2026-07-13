"use client"

import api from "@/lib/axios"
import type { ApiResponse } from "@/types"

export function billingQuery(path: string, filters: Record<string, unknown> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
  }
  return params.size ? `${path}?${params.toString()}` : path
}

export async function billingGet<T>(path: string) {
  const response = await api.get<ApiResponse<T>>(path)
  if (!response.data.success || response.data.data === undefined) throw new Error(response.data.message || "Billing data could not be loaded.")
  return response.data.data
}

export async function billingMutate<T, P>(method: "post" | "patch", path: string, payload: P) {
  const response = await api[method]<ApiResponse<T>>(path, payload)
  if (!response.data.success || response.data.data === undefined) throw new Error(response.data.message || "Billing update could not be saved.")
  return response.data.data
}
