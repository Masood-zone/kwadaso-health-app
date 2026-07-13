import "dotenv/config"

import { prisma } from "../lib/prisma"
import { seedGhanaLabTests } from "./seeders/ghana-lab-tests"

const facilityCode = process.env.SEED_FACILITY_CODE?.trim() || "SDA-KWADASO"

async function seedLabTests() {
  const facility = await prisma.facility.findUnique({
    where: { code: facilityCode },
    select: { id: true, code: true, name: true },
  })
  if (!facility) {
    throw new Error(
      `Facility ${facilityCode} was not found. Create the facility first or set SEED_FACILITY_CODE.`
    )
  }

  const result = await seedGhanaLabTests(facility.id)
  console.log(
    `Seeded ${result.totalTests} laboratory tests for ${facility.name} (${facility.code}): ${result.createdTests} created, ${result.updatedTests} updated.`
  )
  console.log(
    `Clinician catalog visibility: ${result.activeTests} active, ${result.inactiveTests} inactive pending facility approval.`
  )
  console.log(
    `Verified ${result.totalParameters} parameter definitions: ${result.createdParameters} created during this run.`
  )
  console.log(
    "Prices, reference ranges, critical thresholds, and existing facility activation decisions were preserved."
  )
}

seedLabTests()
  .catch((error) => {
    console.error("Failed to seed Ghana laboratory catalog", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
