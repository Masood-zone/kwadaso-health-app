import { ApiResponse } from "@/types"
import { isAxiosError } from "axios"

export class ApiClientError extends Error {
  code?: string
  status?: number
  fieldErrors?: Record<string, string[]>

  constructor(
    message: string,
    options?: {
      code?: string
      status?: number
      fieldErrors?: Record<string, string[]>
    }
  ) {
    super(message)
    this.name = "ApiClientError"
    this.code = options?.code
    this.status = options?.status
    this.fieldErrors = options?.fieldErrors
  }
}

export function toApiClientError(
  error: unknown,
  fallbackMessage: string
): ApiClientError {
  if (isAxiosError<ApiResponse<never>>(error)) {
    const status = error.response?.status
    const payload = error.response?.data

    if (payload && typeof payload === "object") {
      return new ApiClientError(payload.message || fallbackMessage, {
        code: payload.code,
        status,
        fieldErrors: payload.errors,
      })
    }

    return new ApiClientError(error.message || fallbackMessage, { status })
  }

  if (error instanceof ApiClientError) return error

  if (error instanceof Error) {
    return new ApiClientError(error.message || fallbackMessage)
  }

  return new ApiClientError(fallbackMessage)
}

export function getApiErrorLabel(error: unknown): {
  message: string
  code?: string
} {
  const parsed = toApiClientError(error, "Request failed")
  return { message: parsed.message, code: parsed.code }
}
