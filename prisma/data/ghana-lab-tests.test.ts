import { describe, expect, it } from "vitest"

import { ghanaLabTestCatalog } from "./ghana-lab-tests"

describe("Ghana laboratory catalog seed", () => {
  it("uses stable unique facility codes and test names", () => {
    expect(new Set(ghanaLabTestCatalog.map((test) => test.code)).size).toBe(
      ghanaLabTestCatalog.length
    )
    expect(new Set(ghanaLabTestCatalog.map((test) => test.name)).size).toBe(
      ghanaLabTestCatalog.length
    )
  })

  it("keeps routine tests active and governed tests inactive", () => {
    const activeCodes = new Set(
      ghanaLabTestCatalog
        .filter((test) => test.isActive)
        .map((test) => test.code)
    )
    const inactiveCodes = new Set(
      ghanaLabTestCatalog
        .filter((test) => !test.isActive)
        .map((test) => test.code)
    )
    expect(activeCodes.size).toBe(20)
    expect(activeCodes.has("GH-LAB-MAL-RDT")).toBe(true)
    expect(activeCodes.has("GH-LAB-MAL-MIC")).toBe(true)
    expect(activeCodes.has("GH-LAB-FBC")).toBe(true)
    expect(inactiveCodes.size).toBe(9)
    expect(inactiveCodes.has("GH-LAB-HIV-12")).toBe(true)
    expect(inactiveCodes.has("GH-LAB-TB-XPERT")).toBe(true)
    expect(inactiveCodes.has("GH-LAB-CROSSMATCH")).toBe(true)
  })

  it("defines result fields without unapproved clinical thresholds or prices", () => {
    for (const test of ghanaLabTestCatalog) {
      expect(test.parameters.length).toBeGreaterThan(0)
      expect(test).not.toHaveProperty("price")
      expect(test).not.toHaveProperty("referenceRange")
      for (const parameter of test.parameters) {
        expect(parameter).not.toHaveProperty("referenceLow")
        expect(parameter).not.toHaveProperty("referenceHigh")
        expect(parameter).not.toHaveProperty("criticalLow")
        expect(parameter).not.toHaveProperty("criticalHigh")
      }
    }
  })
})
