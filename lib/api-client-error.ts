import type { ApiFieldErrors, ApiResponse } from "@/types"
import { isAxiosError } from "axios"

type ApiErrorPayload = Pick<ApiResponse<never>, "code" | "errors" | "message">

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isApiFieldErrors(value: unknown): value is ApiFieldErrors {
  if (!isRecord(value)) return false

  return Object.values(value).every(
    (fieldErrors) =>
      Array.isArray(fieldErrors) &&
      fieldErrors.every((message) => typeof message === "string")
  )
}

function parseApiErrorPayload(payload: unknown): ApiErrorPayload | null {
  if (!isRecord(payload)) return null

  return {
    code: typeof payload.code === "string" ? payload.code : undefined,
    errors: isApiFieldErrors(payload.errors) ? payload.errors : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined,
  }
}

export class ApiClientError extends Error {
  code?: string
  status?: number
  fieldErrors?: ApiFieldErrors

  constructor(
    message: string,
    options?: {
      code?: string
      status?: number
      fieldErrors?: ApiFieldErrors
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
    const payload = parseApiErrorPayload(error.response?.data)

    if (payload) {
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
