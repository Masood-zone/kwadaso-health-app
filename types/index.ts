export type * from "@/lib/generated/prisma/models"
export * from "@/lib/generated/prisma/enums"
export type { Prisma, PrismaClient } from "@/lib/generated/prisma/client"

export type ApiFieldErrors = Record<string, string[]>
export type ApiErrorCode = string
export type ApiResponseMeta = Record<string, unknown>

export interface ApiResponse<TData = unknown> {
  success: boolean
  message?: string
  data?: TData
  code?: ApiErrorCode
  errors?: ApiFieldErrors
  meta?: ApiResponseMeta
}

export interface ApiErrorResponse {
  success: false
  message: string
  code?: ApiErrorCode
  errors?: ApiFieldErrors
}

export interface PaginatedResponse<TData> extends ApiResponse<TData[]> {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
