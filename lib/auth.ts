import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"

function getAuthOrigin() {
  const rawUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL

  if (!rawUrl) return undefined

  try {
    const url = new URL(
      rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
        ? rawUrl
        : `https://${rawUrl}`
    )

    return url.origin
  } catch {
    return undefined
  }
}

const authOrigin = getAuthOrigin()

export const auth = betterAuth({
  ...(authOrigin ? { baseURL: authOrigin } : {}),
  basePath: "/api/auth",
  trustedOrigins: authOrigin ? [authOrigin] : undefined,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
})
