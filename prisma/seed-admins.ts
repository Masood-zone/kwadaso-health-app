import "dotenv/config"

import { hashPassword } from "better-auth/crypto"

import { prisma } from "../lib/prisma"
import { DepartmentType, FacilityType } from "../lib/generated/prisma/enums"
import type { StaffRole } from "../types"

type AdminSeed = {
  staffId: string
  firstName: string
  lastName: string
  name: string
  email: string
  password: string
  jobTitle: string
  role: StaffRole
  facility: {
    code: string
    name: string
    type: FacilityType
  }
  department: {
    code: string
    name: string
    type: DepartmentType
  }
}

const DEFAULT_PASSWORD = "ChangeMe123!"

const admins = [
  {
    staffId: "KHS-SA-001",
    firstName: "Kwadaso",
    lastName: "Super Admin",
    name: "Kwadaso Super Admin",
    email: "superadmin@kwadaso.health",
    password: DEFAULT_PASSWORD,
    jobTitle: "System Super Administrator",
    role: "SUPER_ADMIN",
    facility: {
      code: "KHS-HQ",
      name: "Kwadaso Health System Headquarters",
      type: FacilityType.MUNICIPAL_DIRECTORATE,
    },
    department: {
      code: "ADMIN",
      name: "Administration",
      type: DepartmentType.ADMINISTRATION,
    },
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
    facility: {
      code: "KHS-HOSP",
      name: "Kwadaso Municipal Hospital",
      type: FacilityType.HOSPITAL,
    },
    department: {
      code: "ADMIN",
      name: "Administration",
      type: DepartmentType.ADMINISTRATION,
    },
  },
  {
    staffId: "KHS-MHD-001",
    firstName: "Kwadaso",
    lastName: "Health Director",
    name: "Kwadaso Municipal Health Director",
    email: "director@kwadaso.health",
    password: DEFAULT_PASSWORD,
    jobTitle: "Municipal Health Director",
    role: "MUNICIPAL_HEALTH_DIRECTOR",
    facility: {
      code: "KHS-MHD",
      name: "Kwadaso Municipal Health Directorate",
      type: FacilityType.MUNICIPAL_DIRECTORATE,
    },
    department: {
      code: "PUBLIC_HEALTH",
      name: "Public Health",
      type: DepartmentType.PUBLIC_HEALTH,
    },
  },
] as const satisfies readonly AdminSeed[]

async function upsertAdmin(admin: AdminSeed) {
  const passwordHash = await hashPassword(admin.password)

  const user = await prisma.$transaction(async (tx) => {
    const facility = await tx.facility.upsert({
      where: { code: admin.facility.code },
      update: {
        name: admin.facility.name,
        type: admin.facility.type,
        isActive: true,
      },
      create: {
        code: admin.facility.code,
        name: admin.facility.name,
        type: admin.facility.type,
      },
    })

    const department = await tx.department.upsert({
      where: {
        facilityId_code: {
          facilityId: facility.id,
          code: admin.department.code,
        },
      },
      update: {
        name: admin.department.name,
        type: admin.department.type,
        isActive: true,
      },
      create: {
        facilityId: facility.id,
        code: admin.department.code,
        name: admin.department.name,
        type: admin.department.type,
      },
    })

    const role = await tx.role.upsert({
      where: { name: admin.role },
      update: { isSystem: true },
      create: {
        name: admin.role,
        description: admin.jobTitle,
        isSystem: true,
      },
    })

    const user = await tx.user.upsert({
      where: { email: admin.email },
      update: {
        staffId: admin.staffId,
        firstName: admin.firstName,
        lastName: admin.lastName,
        name: admin.name,
        passwordHash,
        jobTitle: admin.jobTitle,
        defaultRole: admin.role,
        status: "ACTIVE",
        facilityId: facility.id,
        departmentId: department.id,
        emailVerified: true,
      },
      create: {
        staffId: admin.staffId,
        email: admin.email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        name: admin.name,
        jobTitle: admin.jobTitle,
        defaultRole: admin.role,
        status: "ACTIVE",
        facilityId: facility.id,
        departmentId: department.id,
        emailVerified: true,
      },
    })

    await tx.userRole.upsert({
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

    await tx.account.upsert({
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
  })

  console.log(`Seeded ${admin.role}: ${user.email}`)
}

async function seedAdmins() {
  for (const admin of admins) {
    await upsertAdmin(admin)
  }
}

seedAdmins()
  .catch((error) => {
    console.error("Failed to seed admins", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
