import { NextRequest } from "next/server"
import { z } from "zod"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import {
  ensureSystemRolesAndPermissions,
  serializePermission,
  serializeRole,
  writeAuditLog,
} from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const updateRolePermissionsSchema = z.object({
  roleId: z.string().min(1),
  permissionKeys: z.array(z.string().min(1)),
})

async function getRoleMatrix() {
  await ensureSystemRolesAndPermissions()

  const [permissions, roles] = await Promise.all([
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    }),
  ])

  return {
    permissions: permissions.map(serializePermission),
    roles: roles.map(serializeRole),
  }
}

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  return Response.json({
    success: true,
    data: await getRoleMatrix(),
  } satisfies ApiResponse)
}

export async function PATCH(request: NextRequest) {
  const { staff: actor, response } = await requireRoleApi(request, [
    "SUPER_ADMIN",
  ])
  if (response) return response

  const parsed = updateRolePermissionsSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Role permission update is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const { roleId, permissionKeys } = parsed.data
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  })

  if (!role || !role.isSystem) {
    return Response.json(
      { success: false, message: "System role was not found." },
      { status: 404 }
    )
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  })
  const nextPermissionIds = new Set(permissions.map((permission) => permission.id))

  await prisma.rolePermission.deleteMany({ where: { roleId } })
  await Promise.all(
    Array.from(nextPermissionIds).map((permissionId) =>
      prisma.rolePermission.create({ data: { roleId, permissionId } })
    )
  )

  await writeAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "RolePermission",
    entityId: roleId,
    description: `Updated permissions for ${role.name}`,
    before: { permissions: role.permissions.map((item) => item.permission.key) },
    after: { permissions: permissions.map((permission) => permission.key) },
  })

  return Response.json({
    success: true,
    data: await getRoleMatrix(),
  } satisfies ApiResponse)
}
