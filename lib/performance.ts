const DEFAULT_SLOW_OPERATION_MS = 750

export type TimedResult<T> = {
  value: T
  durationMs: number
}

export async function measureServerOperation<T>(
  label: string,
  operation: () => Promise<T>
): Promise<TimedResult<T>> {
  const startedAt = performance.now()
  const value = await operation()
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10
  const threshold = Number(
    process.env.SLOW_OPERATION_MS ?? DEFAULT_SLOW_OPERATION_MS
  )

  if (durationMs >= threshold) {
    console.warn("Slow server operation", { label, durationMs })
  }

  return { value, durationMs }
}

export function withServerTiming(
  response: Response,
  metric: string,
  durationMs: number
) {
  const headers = new Headers(response.headers)
  headers.append(
    "Server-Timing",
    `${metric};dur=${durationMs.toFixed(1)}`
  )

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
