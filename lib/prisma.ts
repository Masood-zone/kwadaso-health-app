import { PrismaPg } from "@prisma/adapter-pg"
import { prismaQueryInsights } from "@prisma/sqlcommenter-query-insights"
import { PrismaClient } from "./generated/prisma/client"
import {
  assertProductionTlsEnvironment,
  getVerifiedDatabaseUrl,
} from "./database-url"

const globalForPrisma = global as unknown as { prisma: PrismaClient }

assertProductionTlsEnvironment()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL
        ? getVerifiedDatabaseUrl(process.env.DATABASE_URL)
        : process.env.DATABASE_URL!,
    }),
    comments: [prismaQueryInsights()],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
