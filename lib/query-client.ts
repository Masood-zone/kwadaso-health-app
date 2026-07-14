import { isServer, QueryClient } from "@tanstack/react-query"

export const queryFreshness = {
  live: 5_000,
  dashboard: 30_000,
  detail: 30_000,
  lookup: 5 * 60_000,
} as const

function shouldRetry(failureCount: number, error: unknown) {
  const status =
    typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined

  if (status && status >= 400 && status < 500) return false
  return failureCount < 1
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: queryFreshness.dashboard,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}
