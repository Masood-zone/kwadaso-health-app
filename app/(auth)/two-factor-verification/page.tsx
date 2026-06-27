import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function TwoFactorVerificationPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-app-bg p-4">
      <section className="khms-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-medical-green-soft text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">
            Two-Factor Verification
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Two-factor verification is a placeholder for now.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="code">Verification Code</Label>
          <Input id="code" inputMode="numeric" placeholder="000000" disabled />
        </div>
        <Button className="mt-6 w-full" disabled>
          Verification Not Enabled Yet
        </Button>
        <Button asChild variant="link" className="mt-3 w-full">
          <Link href="/login">Back to Login</Link>
        </Button>
      </section>
    </main>
  )
}
