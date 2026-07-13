import type { StaffRole } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

const APPLICATION_ID_PREFIX = "KHS"
const DEFAULT_PATIENT_PREFIX = `${APPLICATION_ID_PREFIX}-PT`

const staffRoleCodes: Record<StaffRole, string> = {
  SUPER_ADMIN: "SA",
  HOSPITAL_ADMIN: "HA",
  MUNICIPAL_HEALTH_DIRECTOR: "MHD",
  M_AND_E_OFFICER: "ME",
  RECORDS_OFFICER: "RO",
  FRONT_DESK: "FD",
  DOCTOR: "DR",
  PHYSICIAN_ASSISTANT: "PA",
  NURSE: "NU",
  LAB_TECHNICIAN: "LT",
  PHARMACIST: "PH",
  BILLING_OFFICER: "BO",
}

function normalizePrefix(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || fallback
}

async function getHighestExistingValue(prefix: string, identifiers: string[]) {
  const pattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`
  )

  return identifiers.reduce((highest, identifier) => {
    const match = pattern.exec(identifier)
    const value = match ? Number.parseInt(match[1], 10) : 0
    return Number.isFinite(value) ? Math.max(highest, value) : highest
  }, 0)
}

async function reserveNextIdentifier(
  key: string,
  prefix: string,
  width: number,
  existingIdentifiers: () => Promise<string[]>
) {
  const highestExisting = await getHighestExistingValue(
    prefix,
    await existingIdentifiers()
  )

  const sequence = await prisma.identifierSequence.upsert({
    where: { key },
    update: { lastValue: { increment: 1 } },
    create: { key, lastValue: highestExisting + 1 },
  })

  return `${prefix}-${String(sequence.lastValue).padStart(width, "0")}`
}

export function getStaffIdPrefix(role: StaffRole) {
  return `${APPLICATION_ID_PREFIX}-${staffRoleCodes[role]}`
}

export async function generateStaffId(role: StaffRole) {
  const prefix = getStaffIdPrefix(role)
  return reserveNextIdentifier(`staff:${role}`, prefix, 3, async () => {
    const users = await prisma.user.findMany({
      where: { staffId: { startsWith: `${prefix}-` } },
      select: { staffId: true },
    })
    return users.map((user) => user.staffId)
  })
}

export async function generatePatientNo() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "patient.numberPrefix" },
    select: { value: true },
  })
  const configuredPrefix =
    typeof setting?.value === "string" ? setting.value : DEFAULT_PATIENT_PREFIX
  const prefix = normalizePrefix(configuredPrefix, DEFAULT_PATIENT_PREFIX)

  return reserveNextIdentifier(`patient:${prefix}`, prefix, 6, async () => {
    const patients = await prisma.patient.findMany({
      where: { patientNo: { startsWith: `${prefix}-` } },
      select: { patientNo: true },
    })
    return patients.map((patient) => patient.patientNo)
  })
}
