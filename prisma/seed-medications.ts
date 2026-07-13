import "dotenv/config"

import { prisma } from "../lib/prisma"
import { ghanaMedicationCatalog } from "./data/ghana-medications"

const facilityCode = process.env.SEED_FACILITY_CODE?.trim() || "SDA-KWADASO"

async function seedMedications() {
  const facility = await prisma.facility.findUnique({
    where: { code: facilityCode },
    select: { id: true, code: true, name: true },
  })

  if (!facility) {
    throw new Error(
      `Facility ${facilityCode} was not found. Create the facility first or set SEED_FACILITY_CODE.`
    )
  }

  const codes = ghanaMedicationCatalog.map((medication) => medication.code)
  const existing = await prisma.medication.findMany({
    where: { facilityId: facility.id, code: { in: codes } },
    select: { code: true },
  })
  const existingCodes = new Set(
    existing.flatMap((item) => (item.code ? [item.code] : []))
  )

  for (let index = 0; index < ghanaMedicationCatalog.length; index += 15) {
    const batch = ghanaMedicationCatalog.slice(index, index + 15)
    await prisma.$transaction(
      batch.map((medication) =>
        prisma.medication.upsert({
          where: {
            facilityId_code: {
              facilityId: facility.id,
              code: medication.code,
            },
          },
          update: {
            name: medication.name,
            genericName: medication.genericName,
            category: medication.category,
            dosageForm: medication.dosageForm,
            strength: medication.strength,
            unit: medication.unit,
            reorderLevel: medication.reorderLevel,
            isActive: true,
          },
          create: {
            facilityId: facility.id,
            ...medication,
            isActive: true,
          },
        })
      )
    )
  }

  const created = codes.filter((code) => !existingCodes.has(code)).length
  const activeCount = await prisma.medication.count({
    where: {
      facilityId: facility.id,
      code: { in: codes },
      isActive: true,
    },
  })
  if (activeCount !== ghanaMedicationCatalog.length) {
    throw new Error(
      `Medication seed verification failed: expected ${ghanaMedicationCatalog.length} active rows, found ${activeCount}.`
    )
  }
  console.log(
    `Seeded ${ghanaMedicationCatalog.length} Ghana medicine catalog entries for ${facility.name} (${facility.code}): ${created} created, ${ghanaMedicationCatalog.length - created} updated.`
  )
  console.log(
    `Verified ${activeCount} active facility-scoped rows available to clinician lookups.`
  )
  console.log(
    "No stock quantities, prices, or prescribing directions were changed."
  )
}

seedMedications()
  .catch((error) => {
    console.error("Failed to seed Ghana medicine catalog", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
