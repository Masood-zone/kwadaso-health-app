import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"

const authURL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
const authOrigin = authURL ? new URL(authURL).origin : undefined

export const auth = betterAuth({
  ...(authOrigin ? { baseURL: authOrigin } : {}),
  basePath: "/api/auth",
  trustedOrigins: authOrigin ? [authOrigin] : undefined,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
      strategy: "compact",
    },
    deferSessionRefresh: true,
  },
  emailAndPassword: {
    enabled: true,
  },
})
