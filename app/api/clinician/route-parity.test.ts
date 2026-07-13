import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const routes: Record<string, string[]> = {
  "dashboard": ["GET"], "lookups": ["GET"], "consultation-queue": ["GET"], "consultation-queue/[id]": ["PATCH"], "patients": ["GET"], "patients/[id]/clinical-profile": ["GET"],
  "encounters": ["GET", "POST"], "encounters/[id]": ["GET", "PATCH"], "encounters/[id]/complete": ["POST"], "encounters/[id]/clinical-notes": ["GET", "POST"], "encounters/[id]/clinical-notes/[noteId]": ["PATCH"],
  "encounters/[id]/diagnoses": ["GET", "POST"], "encounters/[id]/diagnoses/[diagnosisId]": ["PATCH", "DELETE"], "encounters/[id]/lab-requests": ["POST"], "encounters/[id]/prescriptions": ["POST"], "encounters/[id]/follow-up": ["POST"], "encounters/[id]/referrals": ["POST"],
  "lab-requests": ["GET"], "lab-requests/[id]": ["GET", "PATCH"], "lab-results": ["GET"], "lab-results/[id]": ["GET"], "prescriptions": ["GET"], "prescriptions/[id]": ["GET", "PATCH"], "referrals": ["GET"], "referrals/[id]": ["GET", "PATCH"],
  "follow-ups": ["GET"], "messages": ["GET", "POST"], "notifications": ["GET"], "notifications/[id]": ["PATCH"],
}

describe("clinician concrete route parity", () => {
  it.each(Object.entries(routes))("exposes /api/clinician/%s with the original methods", (route, methods) => {
    const file = join(process.cwd(), "app", "api", "clinician", ...route.split("/"), "route.ts")
    expect(existsSync(file), file).toBe(true)
    const source = readFileSync(file, "utf8")
    for (const method of methods) expect(source).toMatch(new RegExp(`export\\s+async\\s+function\\s+${method}\\b`))
  })

  it("has no optional catch-all and makes dashboard a physical route", () => {
    expect(existsSync(join(process.cwd(), "app", "api", "clinician", "[[...path]]", "route.ts"))).toBe(false)
    expect(existsSync(join(process.cwd(), "app", "api", "clinician", "dashboard", "route.ts"))).toBe(true)
  })
})
