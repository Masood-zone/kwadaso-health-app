import { createAuthClient } from "better-auth/react"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL

export const authClient = createAuthClient({
  baseURL: `${BASE_URL}/auth` || "http://localhost:3000/api/auth",
})

export const { signIn, signOut, signUp, useSession } = authClient
