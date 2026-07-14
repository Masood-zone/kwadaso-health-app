import { describe, expect, it } from "vitest"

import { makeQueryClient, queryFreshness } from "@/lib/query-client"

describe("shared query policies", () => {
  it("uses balanced live defaults", () => {
    const options = makeQueryClient().getDefaultOptions()

    expect(options.queries?.staleTime).toBe(queryFreshness.dashboard)
    expect(options.queries?.refetchOnWindowFocus).toBe(false)
    expect(options.queries?.refetchOnReconnect).toBe(true)
    expect(options.mutations?.retry).toBe(false)
  })

  it("retries transient failures once but never retries client errors", () => {
    const retry = makeQueryClient().getDefaultOptions().queries?.retry
    expect(typeof retry).toBe("function")
    if (typeof retry !== "function") return

    expect(retry(0, new Error("temporary"))).toBe(true)
    expect(retry(1, new Error("temporary"))).toBe(false)
    expect(
      retry(0, { response: { status: 403 } } as Error & {
        response: { status: number }
      })
    ).toBe(false)
  })
})
