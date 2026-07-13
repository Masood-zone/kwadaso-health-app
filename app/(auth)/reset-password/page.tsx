import type { Metadata } from "next"
import Link from "next/link"
import { KeyRound } from "lucide-react"

import { sectionMetadata } from "@/lib/metadata"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const metadata: Metadata = sectionMetadata({
  title: "Reset Password",
  description: "Password reset page for authorized KHIP staff.",
  path: "/reset-password",
})

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-app-bg p-4">
      <section className="khms-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-medical-green-soft text-primary">
            <KeyRound className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reset links will be activated in a later phase.
          </p>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" disabled />
          </div>
        </div>
        <Button className="mt-6 w-full" disabled>
          Reset Not Enabled Yet
        </Button>
        <Button asChild variant="link" className="mt-3 w-full">
          <Link href="/login">Back to Login</Link>
        </Button>
      </section>
    </main>
  )
}
