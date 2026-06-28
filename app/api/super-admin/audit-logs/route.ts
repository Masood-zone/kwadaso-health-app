import { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import type { PaginatedResponse } from "@/types"
import type { SuperAdminAuditLogItem } from "@/types/super-admin"

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 10), 1), 50)
  const actorId = searchParams.get("actorId")
  const action = searchParams.get("action")
  const entityType = searchParams.get("entityType")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const where = {
    ...(actorId ? { actorId } : {}),
    ...(action ? { action: action as never } : {}),
    ...(entityType ? { entityType: { contains: entityType, mode: "insensitive" as const } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    }),
  ])

  const data: SuperAdminAuditLogItem[] = logs.map((log) => ({
    id: log.id,
    actorName: log.actor?.name ?? "System",
    actorEmail: log.actor?.email ?? null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    description: log.description,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }))

  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
  } satisfies PaginatedResponse<SuperAdminAuditLogItem>)
}

