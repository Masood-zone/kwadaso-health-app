import { describe, expect, it } from "vitest"

import {
  assertProductionTlsEnvironment,
  getVerifiedDatabaseUrl,
} from "@/lib/database-url"

describe("database TLS configuration", () => {
  it("upgrades permissive TLS modes to hostname verification", () => {
    const result = getVerifiedDatabaseUrl(
      "postgresql://app:secret@db.example.test:5432/health?sslmode=require"
    )

    expect(new URL(result).searchParams.get("sslmode")).toBe("verify-full")
  })

  it("rejects globally disabled TLS verification in production", () => {
    expect(() => assertProductionTlsEnvironment("production", "0")).toThrow(
      "NODE_TLS_REJECT_UNAUTHORIZED=0"
    )
  })
})
