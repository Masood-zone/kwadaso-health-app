import "dotenv/config"

import { hashPassword } from "better-auth/crypto"

import { prisma } from "../lib/prisma"
import { ensureSystemRolesAndPermissions } from "../lib/super-admin"
import { DepartmentType, FacilityType } from "../lib/generated/prisma/enums"
import type { StaffRole } from "../types"

type StaffSeed = {
  staffId: string
  firstName: string
  lastName: string
  name: string
  email: string
  password: string
  jobTitle: string
  role: StaffRole
  departmentCode: string
}

const DEFAULT_PASSWORD = "ChangeMe123!"

const hospital = {
  code: "SDA-KWADASO",
  name: "SDA Hospital Kwadaso",
  type: FacilityType.HOSPITAL,
  phone: "+233 302 000 000",
  email: "info@sdakwadaso.health",
  address: "SDA Hospital, Kwadaso, Kumasi",
}

const departments = [
  {
    code: "ADMIN",
    name: "Administration",
    type: DepartmentType.ADMINISTRATION,
  },
  { code: "RECORDS", name: "Records Office", type: DepartmentType.RECORDS },
  { code: "OPD", name: "Outpatient Department", type: DepartmentType.OPD },
  { code: "TRIAGE", name: "Triage", type: DepartmentType.TRIAGE },
  {
    code: "CONSULT",
    name: "General Consultation",
    type: DepartmentType.GENERAL_CONSULTATION,
  },
  { code: "LAB", name: "Laboratory", type: DepartmentType.LABORATORY },
  { code: "PHARM", name: "Pharmacy", type: DepartmentType.PHARMACY },
  { code: "BILL", name: "Billing", type: DepartmentType.BILLING },
  {
    code: "PUBHEALTH",
    name: "Public Health",
    type: DepartmentType.PUBLIC_HEALTH,
  },
] as const

const staffMembers = [
  {
    staffId: "KHS-SA-001",
    firstName: "Kwadaso",
    lastName: "Super Admin",
    name: "Kwadaso Super Admin",
    email: "superadmin@kwadaso.health",
    password: DEFAULT_PASSWORD,
    jobTitle: "System Super Administrator",
    role: "SUPER_ADMIN",
    departmentCode: "ADMIN",
  },
  {
    staffId: "KHS-HA-001",
    firstName: "Kwadaso",
    lastName: "Hospital Admin",
    name: "Kwadaso Hospital Admin",
    email: "hospitaladmin@kwadaso.health",
    password: DEFAULT_PASSWORD,
    jobTitle: "Hospital Administrator",
    role: "HOSPITAL_ADMIN",
    departmentCode: "ADMIN",
  },
  {
    staffId: "KHS-NU-001",
    firstName: "Akosua",
    lastName: "Triage",
    name: "Akosua Triage Nurse",
    email: "nurse@kwadaso.health",
    password: DEFAULT_PASSWORD,
    jobTitle: "Triage Nurse",
    role: "NURSE",
    departmentCode: "TRIAGE",
  },
  {
    staffId: "KHS-RO-001",
    firstName: "Mr Man",
    lastName: "Miller",
    name: "Mr Man Miller",
    email: "recordofficer@kwadaso.health",
    password: DEFAULT_PASSWORD,
    jobTitle: "Records Officer",
    role: "RECORDS_OFFICER",
    departmentCode: "RECORDS",
  },
] as const satisfies readonly StaffSeed[]

const medications = [
  {
    code: "MED-PAR-500",
    name: "Paracetamol 500mg",
    genericName: "Paracetamol",
    category: "Analgesic",
    dosageForm: "Tablet",
    strength: "500mg",
    unit: "tablet",
    reorderLevel: 200,
    batchNumber: "PAR-KWA-001",
    quantityOnHand: 1200,
    unitCost: 0.25,
    sellingPrice: 0.5,
  },
  {
    code: "MED-AMO-500",
    name: "Amoxicillin 500mg",
    genericName: "Amoxicillin",
    category: "Antibiotic",
    dosageForm: "Capsule",
    strength: "500mg",
    unit: "capsule",
    reorderLevel: 150,
    batchNumber: "AMO-KWA-001",
    quantityOnHand: 620,
    unitCost: 1.1,
    sellingPrice: 1.8,
  },
  {
    code: "MED-ORS-SAC",
    name: "Oral Rehydration Salts",
    genericName: "ORS",
    category: "Rehydration",
    dosageForm: "Sachet",
    strength: "20.5g",
    unit: "sachet",
    reorderLevel: 100,
    batchNumber: "ORS-KWA-001",
    quantityOnHand: 90,
    unitCost: 0.75,
    sellingPrice: 1.2,
  },
] as const

async function seedFacilityAndDepartments() {
  const facility = await prisma.facility.upsert({
    where: { code: hospital.code },
    update: {
      name: hospital.name,
      type: hospital.type,
      phone: hospital.phone,
      email: hospital.email,
      address: hospital.address,
      municipality: "Kwadaso",
      region: "Ashanti",
      isActive: true,
    },
    create: {
      ...hospital,
      municipality: "Kwadaso",
      region: "Ashanti",
      isActive: true,
    },
  })

  const departmentMap = new Map<string, { id: string }>()

  for (const department of departments) {
    const seeded = await prisma.department.upsert({
      where: {
        facilityId_code: {
          facilityId: facility.id,
          code: department.code,
        },
      },
      update: {
        name: department.name,
        type: department.type,
        isActive: true,
      },
      create: {
        facilityId: facility.id,
        code: department.code,
        name: department.name,
        type: department.type,
      },
      select: { id: true },
    })

    departmentMap.set(department.code, seeded)
  }

  return { facility, departmentMap }
}

async function upsertStaff(
  staff: StaffSeed,
  facilityId: string,
  departmentId: string
) {
  const passwordHash = await hashPassword(staff.password)

  const role = await prisma.role.upsert({
    where: { name: staff.role },
    update: {
      description: staff.jobTitle,
      isSystem: true,
    },
    create: {
      name: staff.role,
      description: staff.jobTitle,
      isSystem: true,
    },
  })

  const user = await prisma.user.upsert({
    where: { email: staff.email },
    update: {
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      name: staff.name,
      passwordHash,
      jobTitle: staff.jobTitle,
      defaultRole: staff.role,
      status: "ACTIVE",
      facilityId,
      departmentId,
      emailVerified: true,
    },
    create: {
      staffId: staff.staffId,
      email: staff.email,
      passwordHash,
      firstName: staff.firstName,
      lastName: staff.lastName,
      name: staff.name,
      jobTitle: staff.jobTitle,
      defaultRole: staff.role,
      status: "ACTIVE",
      facilityId,
      departmentId,
      emailVerified: true,
    },
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  })

  await prisma.account.upsert({
    where: { id: `credential:${user.id}` },
    update: {
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    },
    create: {
      id: `credential:${user.id}`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    },
  })

  return user
}

async function seedPharmacy(facilityId: string, performedById: string) {
  for (const item of medications) {
    const medication = await prisma.medication.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        genericName: item.genericName,
        category: item.category,
        dosageForm: item.dosageForm,
        strength: item.strength,
        unit: item.unit,
        reorderLevel: item.reorderLevel,
        isActive: true,
      },
      create: {
        code: item.code,
        name: item.name,
        genericName: item.genericName,
        category: item.category,
        dosageForm: item.dosageForm,
        strength: item.strength,
        unit: item.unit,
        reorderLevel: item.reorderLevel,
        isActive: true,
      },
    })

    const stock = await prisma.medicationStock.upsert({
      where: {
        facilityId_medicationId_batchNumber: {
          facilityId,
          medicationId: medication.id,
          batchNumber: item.batchNumber,
        },
      },
      update: {
        quantityOnHand: item.quantityOnHand,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
      },
      create: {
        facilityId,
        medicationId: medication.id,
        batchNumber: item.batchNumber,
        expiryDate: new Date("2027-12-31"),
        quantityOnHand: item.quantityOnHand,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
      },
    })

    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        stockId: stock.id,
        medicationId: medication.id,
        reference: `SEED-${item.batchNumber}`,
      },
    })

    if (!existingMovement) {
      await prisma.stockMovement.create({
        data: {
          stockId: stock.id,
          medicationId: medication.id,
          type: "OPENING_BALANCE",
          quantity: item.quantityOnHand,
          reason: "Initial KHMS pharmacy seed stock",
          reference: `SEED-${item.batchNumber}`,
          performedById,
        },
      })
    }
  }
}

async function seedPatientFlow(
  facilityId: string,
  departmentMap: Map<string, { id: string }>,
  nurseId: string,
  adminId: string
) {
  const triageId = departmentMap.get("TRIAGE")!.id
  const consultationId = departmentMap.get("CONSULT")!.id

  const patient = await prisma.patient.upsert({
    where: { patientNo: "SDA-P-0001" },
    update: {
      firstName: "Akua",
      lastName: "Mensah",
      gender: "FEMALE",
      status: "ACTIVE",
      registeredFacilityId: facilityId,
    },
    create: {
      patientNo: "SDA-P-0001",
      firstName: "Akua",
      lastName: "Mensah",
      gender: "FEMALE",
      estimatedAge: 34,
      phone: "0240000001",
      community: "Kwadaso",
      registeredFacilityId: facilityId,
      registeredById: adminId,
    },
  })

  const secondPatient = await prisma.patient.upsert({
    where: { patientNo: "SDA-P-0002" },
    update: {
      firstName: "Kojo",
      lastName: "Agyeman",
      gender: "MALE",
      status: "ACTIVE",
      registeredFacilityId: facilityId,
    },
    create: {
      patientNo: "SDA-P-0002",
      firstName: "Kojo",
      lastName: "Agyeman",
      gender: "MALE",
      estimatedAge: 47,
      phone: "0240000002",
      community: "Asuoyeboah",
      registeredFacilityId: facilityId,
      registeredById: adminId,
    },
  })

  const encounter = await prisma.encounter.upsert({
    where: { encounterNo: "ENC-SDA-0001" },
    update: {
      patientId: patient.id,
      facilityId,
      departmentId: consultationId,
      status: "IN_PROGRESS",
      chiefComplaint: "Fever and headache",
    },
    create: {
      encounterNo: "ENC-SDA-0001",
      patientId: patient.id,
      facilityId,
      departmentId: consultationId,
      status: "IN_PROGRESS",
      chiefComplaint: "Fever and headache",
    },
  })

  await prisma.appointment.upsert({
    where: { appointmentNo: "APT-SDA-0001" },
    update: {
      patientId: patient.id,
      facilityId,
      departmentId: consultationId,
      title: "OPD consultation",
      scheduledAt: new Date(),
      status: "CHECKED_IN",
    },
    create: {
      appointmentNo: "APT-SDA-0001",
      patientId: patient.id,
      facilityId,
      departmentId: consultationId,
      title: "OPD consultation",
      reason: "Fever and headache",
      scheduledAt: new Date(),
      status: "CHECKED_IN",
      createdById: adminId,
    },
  })

  await ensureQueueEntry({
    departmentId: triageId,
    patientId: patient.id,
    queueNo: "TR-001",
    priority: "URGENT",
    status: "IN_TRIAGE",
    notes: "High fever reported at front desk",
  })

  await ensureQueueEntry({
    departmentId: triageId,
    patientId: secondPatient.id,
    queueNo: "TR-002",
    priority: "ROUTINE",
    status: "WAITING",
    notes: "Routine vitals pending",
  })

  const existingVitals = await prisma.vitalSigns.findFirst({
    where: { patientId: patient.id, capturedById: nurseId },
  })

  if (!existingVitals) {
    await prisma.vitalSigns.create({
      data: {
        patientId: patient.id,
        encounterId: encounter.id,
        temperatureC: 38.4,
        systolicBp: 128,
        diastolicBp: 82,
        pulseRate: 96,
        respiratoryRate: 21,
        oxygenSaturation: 98,
        triagePriority: "URGENT",
        capturedById: nurseId,
        notes: "Fever with mild dehydration",
      },
    })
  }

  await prisma.invoice.upsert({
    where: { invoiceNo: "INV-SDA-0001" },
    update: {
      patientId: patient.id,
      encounterId: encounter.id,
      facilityId,
      status: "PARTIALLY_PAID",
      subtotal: 120,
      totalAmount: 120,
      amountPaid: 80,
      balanceDue: 40,
      issuedAt: new Date(),
      createdById: adminId,
    },
    create: {
      invoiceNo: "INV-SDA-0001",
      patientId: patient.id,
      encounterId: encounter.id,
      facilityId,
      status: "PARTIALLY_PAID",
      subtotal: 120,
      totalAmount: 120,
      amountPaid: 80,
      balanceDue: 40,
      issuedAt: new Date(),
      createdById: adminId,
    },
  })

  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      actorId: adminId,
      entityType: "SeedData",
      description: "Initialized SDA Hospital Kwadaso demo workflow",
    },
  })

  if (!existingAudit) {
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "CREATE",
        entityType: "SeedData",
        entityId: facilityId,
        description: "Initialized SDA Hospital Kwadaso demo workflow",
      },
    })
  }
}

async function ensureQueueEntry(data: {
  departmentId: string
  patientId: string
  queueNo: string
  priority: "ROUTINE" | "PRIORITY" | "URGENT" | "EMERGENCY"
  status:
    | "WAITING"
    | "IN_TRIAGE"
    | "WITH_CLINICIAN"
    | "AWAITING_LAB"
    | "AWAITING_PHARMACY"
    | "COMPLETED"
    | "CANCELLED"
  notes: string
}) {
  const existing = await prisma.patientQueue.findFirst({
    where: {
      departmentId: data.departmentId,
      queueNo: data.queueNo,
      patientId: data.patientId,
    },
  })

  if (existing) {
    return prisma.patientQueue.update({
      where: { id: existing.id },
      data: {
        priority: data.priority,
        status: data.status,
        notes: data.notes,
      },
    })
  }

  return prisma.patientQueue.create({
    data,
  })
}

async function seedAdmins() {
  await ensureSystemRolesAndPermissions()

  const { facility, departmentMap } = await seedFacilityAndDepartments()
  const users = new Map<StaffRole, { id: string }>()

  for (const staff of staffMembers) {
    const department = departmentMap.get(staff.departmentCode)
    if (!department) {
      throw new Error(`Missing department ${staff.departmentCode}`)
    }

    const user = await upsertStaff(staff, facility.id, department.id)
    users.set(staff.role, user)
    console.log(`Seeded ${staff.role}: ${user.email}`)
  }

  await seedPharmacy(facility.id, users.get("SUPER_ADMIN")!.id)
  await seedPatientFlow(
    facility.id,
    departmentMap,
    users.get("NURSE")!.id,
    users.get("HOSPITAL_ADMIN")!.id
  )

  console.log(
    "Seeded SDA Hospital Kwadaso departments, pharmacy, and demo flow."
  )
}

seedAdmins()
  .catch((error) => {
    console.error("Failed to seed KHMS data", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
