import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { ensureSystemRolesAndPermissions, serializePermission } from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  await ensureSystemRolesAndPermissions()
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { name: "asc" }],
  })

  return Response.json({
    success: true,
    data: permissions.map(serializePermission),
  } satisfies ApiResponse)
}
