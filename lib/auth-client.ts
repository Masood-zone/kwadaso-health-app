import { createAuthClient } from "better-auth/react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
})

export const { signIn, signOut, signUp, useSession } = authClient
