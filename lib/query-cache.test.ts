import { describe, expect, it } from "vitest"

import { makeQueryClient } from "@/lib/query-client"
import { setOptimisticQueryData } from "@/lib/query-cache"

describe("targeted mutation cache updates", () => {
  it("updates only the exact key and rolls back on failure", () => {
    const queryClient = makeQueryClient()
    const settingsKey = ["super-admin", "settings"] as const
    const dashboardKey = ["super-admin", "dashboard", "summary"] as const
    const original = { facility: { name: "Original" } }
    const dashboard = { metrics: ["unchanged"] }
    queryClient.setQueryData(settingsKey, original)
    queryClient.setQueryData(dashboardKey, dashboard)

    const rollback = setOptimisticQueryData(queryClient, settingsKey, {
      facility: { name: "Updated" },
    })

    expect(queryClient.getQueryData(settingsKey)).toEqual({
      facility: { name: "Updated" },
    })
    expect(queryClient.getQueryData(dashboardKey)).toBe(dashboard)

    rollback()
    expect(queryClient.getQueryData(settingsKey)).toEqual(original)
  })
})
