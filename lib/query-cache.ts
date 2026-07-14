import type { QueryClient, QueryKey } from "@tanstack/react-query"

export function setOptimisticQueryData<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  nextValue: T
) {
  const previousValue = queryClient.getQueryData<T>(queryKey)
  queryClient.setQueryData(queryKey, nextValue)

  return () => {
    if (previousValue === undefined) queryClient.removeQueries({ queryKey, exact: true })
    else queryClient.setQueryData(queryKey, previousValue)
  }
}
