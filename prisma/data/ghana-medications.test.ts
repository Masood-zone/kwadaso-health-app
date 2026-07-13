import { describe, expect, it } from "vitest"

import { ghanaMedicationCatalog } from "./ghana-medications"

describe("Ghana medication catalog seed", () => {
  it("uses stable unique codes and distinct product names", () => {
    expect(new Set(ghanaMedicationCatalog.map((item) => item.code)).size).toBe(
      ghanaMedicationCatalog.length
    )
    expect(new Set(ghanaMedicationCatalog.map((item) => item.name)).size).toBe(
      ghanaMedicationCatalog.length
    )
  })

  it("covers malaria and common chronic-disease medicine groups", () => {
    const categories = new Set<string>(
      ghanaMedicationCatalog.map((item) => item.category)
    )
    for (const category of [
      "Antimalarial",
      "Antihypertensive",
      "Antidiabetic",
      "Bronchodilator",
      "Sickle Cell Medicine",
    ]) {
      expect(categories.has(category)).toBe(true)
    }
  })

  it("contains catalog metadata only, without prescribing defaults", () => {
    for (const medication of ghanaMedicationCatalog) {
      expect(medication).not.toHaveProperty("dosage")
      expect(medication).not.toHaveProperty("frequency")
      expect(medication).not.toHaveProperty("duration")
      expect(medication).not.toHaveProperty("instructions")
    }
  })
})
