import { prisma } from "../../lib/prisma"
import {
  ghanaLabTestCatalog,
  type GhanaLabParameterSeed,
} from "../data/ghana-lab-tests"

export type GhanaLabSeedResult = {
  totalTests: number
  createdTests: number
  updatedTests: number
  activeTests: number
  inactiveTests: number
  totalParameters: number
  createdParameters: number
}

export async function seedGhanaLabTests(
  facilityId: string
): Promise<GhanaLabSeedResult> {
  const codes = ghanaLabTestCatalog.map((test) => test.code)
  const existingTests = await prisma.labTestCatalog.findMany({
    where: { facilityId, code: { in: codes } },
    select: { code: true },
  })
  const existingCodes = new Set(existingTests.map((test) => test.code))

  for (let index = 0; index < ghanaLabTestCatalog.length; index += 8) {
    const batch = ghanaLabTestCatalog.slice(index, index + 8)
    await prisma.$transaction(
      batch.map((test) =>
        prisma.labTestCatalog.upsert({
          where: { facilityId_code: { facilityId, code: test.code } },
          update: {
            name: test.name,
            category: test.category,
            sampleType: test.sampleType,
          },
          create: {
            facilityId,
            code: test.code,
            name: test.name,
            category: test.category,
            sampleType: test.sampleType,
            unit: null,
            referenceRange: null,
            price: null,
            turnaroundHours: test.turnaroundHours,
            isActive: test.isActive,
          },
        })
      )
    )
  }

  const testRows = await prisma.labTestCatalog.findMany({
    where: { facilityId, code: { in: codes } },
    select: { id: true, code: true, isActive: true },
  })
  const testIdByCode = new Map(testRows.map((test) => [test.code, test.id]))
  const existingParameters = await prisma.labTestParameterDefinition.findMany({
    where: { labTestCatalogId: { in: testRows.map((test) => test.id) } },
    select: { labTestCatalogId: true, name: true },
  })
  const existingParameterKeys = new Set(
    existingParameters.map(
      (parameter) => `${parameter.labTestCatalogId}:${parameter.name}`
    )
  )
  let createdParameters = 0
  const parameterOperations = ghanaLabTestCatalog
    .flatMap((test) => {
      const labTestCatalogId = testIdByCode.get(test.code)
      if (!labTestCatalogId) {
        throw new Error(
          `Seeded laboratory test ${test.code} could not be reloaded.`
        )
      }
      return test.parameters.map((parameter, sortOrder) => {
        const definition: GhanaLabParameterSeed = parameter
        if (
          existingParameterKeys.has(`${labTestCatalogId}:${definition.name}`)
        ) {
          return null
        }
        createdParameters += 1
        return prisma.labTestParameterDefinition.upsert({
          where: {
            labTestCatalogId_name: {
              labTestCatalogId,
              name: definition.name,
            },
          },
          update: {},
          create: {
            labTestCatalogId,
            name: definition.name,
            unit: definition.unit ?? null,
            referenceRange: null,
            referenceLow: null,
            referenceHigh: null,
            criticalLow: null,
            criticalHigh: null,
            isRequired: definition.isRequired ?? true,
            sortOrder,
            isActive: true,
          },
        })
      })
    })
    .filter((operation) => operation !== null)

  for (let index = 0; index < parameterOperations.length; index += 4) {
    await prisma.$transaction(parameterOperations.slice(index, index + 4))
  }

  const verified = await prisma.labTestCatalog.findMany({
    where: { facilityId, code: { in: codes } },
    select: {
      code: true,
      isActive: true,
      parameterDefinitions: { select: { name: true } },
    },
  })
  if (verified.length !== ghanaLabTestCatalog.length) {
    throw new Error(
      `Laboratory seed verification failed: expected ${ghanaLabTestCatalog.length} tests, found ${verified.length}.`
    )
  }
  for (const test of ghanaLabTestCatalog) {
    const row = verified.find((candidate) => candidate.code === test.code)
    const names = new Set(
      row?.parameterDefinitions.map((parameter) => parameter.name) ?? []
    )
    const missing = test.parameters.filter(
      (parameter) => !names.has(parameter.name)
    )
    if (missing.length) {
      throw new Error(
        `${test.code} is missing seeded parameter(s): ${missing.map((parameter) => parameter.name).join(", ")}.`
      )
    }
  }

  const createdTests = codes.filter((code) => !existingCodes.has(code)).length
  return {
    totalTests: verified.length,
    createdTests,
    updatedTests: verified.length - createdTests,
    activeTests: verified.filter((test) => test.isActive).length,
    inactiveTests: verified.filter((test) => !test.isActive).length,
    totalParameters: ghanaLabTestCatalog.reduce(
      (sum, test) => sum + test.parameters.length,
      0
    ),
    createdParameters,
  }
}
