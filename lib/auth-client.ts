import { createAuthClient } from "better-auth/react"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL

export const authClient = createAuthClient({
  basePath: `${BASE_URL}/api/auth`,
})

export const { signIn, signOut, signUp, useSession } = authClient
