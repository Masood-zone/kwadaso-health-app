import "dotenv/config"

import { Role } from "../app/generated/prisma/enums"
import { auth } from "../lib/auth"
import { prisma } from "../lib/prisma"

const admins = [
  {
    name: "Amanah Super Admin",
    email: "superadmin@gmail.com",
    password: "ChangeMe123!",
    role: Role.SUPER_ADMIN,
  },
  // {
  //   name: "Amanah Admin",
  //   email: "admin@amanah.welfare",
  //   password: "ChangeMe123!",
  //   role: Role.ADMIN,
  // },
] as const

async function seedAdmins() {
  for (const admin of admins) {
    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
      select: { id: true, email: true, role: true },
    })

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: admin.name, role: admin.role },
      })
      console.log(`Updated existing admin: ${admin.email}`)
      continue
    }

    await auth.api.signUpEmail({
      body: {
        name: admin.name,
        email: admin.email,
        password: admin.password,
        role: admin.role,
      },
    })

    console.log(`Created admin through Better Auth: ${admin.email}`)
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
