import type { Metadata } from "next"
import Link from "next/link"
import { Mail } from "lucide-react"

import { sectionMetadata } from "@/lib/metadata"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const metadata: Metadata = sectionMetadata({
  title: "Password Recovery",
  description:
    "Password recovery page for authorized KHIP staff.",
  path: "/forgot-password",
})

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-app-bg p-4">
      <section className="khms-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-medical-green-soft text-primary">
            <Mail className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">
            Password Recovery
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This flow is reserved for the next auth phase.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Staff Email</Label>
          <Input id="email" type="email" placeholder="name@kwadaso.health" disabled />
        </div>
        <Button className="mt-6 w-full" disabled>
          Recovery Not Enabled Yet
        </Button>
        <Button asChild variant="link" className="mt-3 w-full">
          <Link href="/login">Back to Login</Link>
        </Button>
      </section>
    </main>
  )
}
