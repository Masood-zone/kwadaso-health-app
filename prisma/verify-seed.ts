import "dotenv/config"

import { StaffRole } from "../lib/generated/prisma/enums"
import { prisma } from "../lib/prisma"

async function verifySeed() {
  const [users, patients, departments, medications, labTests, roles, permissions] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          staffId: true,
          email: true,
          defaultRole: true,
          status: true,
          roles: { select: { role: { select: { name: true } } } },
        },
        orderBy: { defaultRole: "asc" },
      }),
      prisma.patient.findMany({
        select: { patientNo: true },
        orderBy: { patientNo: "asc" },
      }),
      prisma.department.count(),
      prisma.medication.count(),
      prisma.labTestCatalog.count(),
      prisma.role.findMany({
        select: { name: true, _count: { select: { permissions: true } } },
      }),
      prisma.permission.count(),
    ])

  const missingRoles = Object.values(StaffRole).filter(
    (role) => !users.some((user) => user.defaultRole === role)
  )
  const invalidUsers = users.filter(
    (user) =>
      user.status !== "ACTIVE" ||
      !user.roles.some((assignment) => assignment.role.name === user.defaultRole) ||
      !/^KHS-[A-Z]+-\d{3}$/.test(user.staffId)
  )
  const invalidPatients = patients.filter(
    (patient) => !/^KHS-PT-\d{6}$/.test(patient.patientNo)
  )
  const rolesWithoutPermissions = roles.filter(
    (role) => role._count.permissions === 0
  )

  if (
    missingRoles.length ||
    invalidUsers.length ||
    invalidPatients.length ||
    rolesWithoutPermissions.length
  ) {
    throw new Error(
      JSON.stringify(
        {
          missingRoles,
          invalidUsers: invalidUsers.map((user) => user.email),
          invalidPatients: invalidPatients.map((patient) => patient.patientNo),
          rolesWithoutPermissions: rolesWithoutPermissions.map((role) => role.name),
        },
        null,
        2
      )
    )
  }

  console.log(
    JSON.stringify(
      {
        staffAccounts: users.map(({ staffId, email, defaultRole }) => ({
          staffId,
          email,
          role: defaultRole,
        })),
        patientNumbers: patients.map((patient) => patient.patientNo),
        totals: {
          staff: users.length,
          roles: roles.length,
          permissions,
          rolePermissions: roles.reduce(
            (total, role) => total + role._count.permissions,
            0
          ),
          departments,
          medications,
          labTests,
          patients: patients.length,
        },
      },
      null,
      2
    )
  )
}

verifySeed()
  .catch((error) => {
    console.error("Seed verification failed", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
