import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDashboardRoute } from "@/lib/role-routes"
import type { StaffRole } from "@/lib/generated/prisma/enums"

export type AuthenticatedStaff = NonNullable<
  Awaited<ReturnType<typeof getCurrentStaff>>
>

export async function getCurrentStaff(request?: NextRequest | Request) {
  const session = await auth.api.getSession({
    headers: request?.headers ?? (await headers()),
  })

  const userId = session?.user?.id
  if (!userId) return null

  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      facility: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  })
}

export async function requireStaffPage(currentPath: string) {
  const staff = await getCurrentStaff()

  if (!staff) {
    redirect(`/login?callbackURL=${encodeURIComponent(currentPath)}`)
  }

  if (staff.status !== "ACTIVE") {
    redirect("/unauthorized")
  }

  return staff
}

export async function requireRolePage(
  currentPath: string,
  allowedRoles: StaffRole[]
) {
  const staff = await requireStaffPage(currentPath)

  if (!allowedRoles.includes(staff.defaultRole)) {
    redirect("/unauthorized")
  }

  return staff
}

export async function redirectToStaffDashboard() {
  const staff = await getCurrentStaff()

  if (!staff) {
    redirect("/login")
  }

  if (staff.status !== "ACTIVE") {
    redirect("/unauthorized")
  }

  redirect(getDashboardRoute(staff.defaultRole))
}

export async function requireRoleApi(
  request: NextRequest,
  allowedRoles: StaffRole[]
) {
  const staff = await getCurrentStaff(request)

  if (!staff) {
    return {
      staff: null,
      response: Response.json(
        {
          success: false,
          message: "Authentication required.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 }
      ),
    }
  }

  if (staff.status !== "ACTIVE" || !allowedRoles.includes(staff.defaultRole)) {
    return {
      staff,
      response: Response.json(
        {
          success: false,
          message: "You do not have permission to access this resource.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      ),
    }
  }

  return { staff, response: null }
}
