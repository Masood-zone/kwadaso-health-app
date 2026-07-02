import type { Metadata } from "next"
import Image from "next/image"
import { Suspense } from "react"
import { ShieldCheck, Zap } from "lucide-react"

import { sectionMetadata } from "@/lib/metadata"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = sectionMetadata({
  title: "Staff Login",
  description:
    "Secure staff login for the Kwadaso HealthLink hospital management portal.",
  path: "/login",
})

export default function LoginPage() {
  return (
    <main className="flex min-h-svh overflow-hidden bg-background text-foreground">
      <section className="relative hidden w-3/5 items-center justify-center overflow-hidden bg-primary p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.08)_1px,transparent_0)] bg-size-[24px_24px]" />
        <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/90 to-deep-forest" />
        <div className="relative z-10 max-w-xl">
          <div className="mb-12 flex flex-col items-start gap-4">
            <Image
              src="/logo.png"
              alt="SDA Hospital Kwadaso"
              width={128}
              height={128}
              className="h-24 w-auto rounded bg-white p-3 shadow-lg"
              priority
            />
            <div className="h-1 w-24 rounded-full bg-secondary-fixed" />
          </div>
          <h1 className="font-heading text-4xl leading-tight font-bold">
            Integrated Healthcare
            <br />
            <span className="text-primary-fixed">Management Excellence</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-primary-fixed-dim">
            Access the KHIP Kwadaso portal to manage patient records, clinical
            operations, pharmacy, billing, reporting, and hospital workflows.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="mb-3 size-5 text-primary-fixed" />
              <p className="khms-label text-white/80">Secure Access</p>
              <p className="mt-1 text-xs text-white/70">
                Role-based clinical data protection.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <Zap className="mb-3 size-5 text-primary-fixed" />
              <p className="khms-label text-white/80">High Efficiency</p>
              <p className="mt-1 text-xs text-white/70">
                Optimized for rapid care coordination.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex w-full items-center justify-center p-6 md:p-12 lg:w-2/5">
        <div className="w-full max-w-md">
          <div className="mb-10 flex flex-col items-center text-center lg:hidden">
            <Image
              src="/logo.png"
              alt="SDA Hospital Kwadaso"
              width={80}
              height={80}
              className="mb-4 h-16 w-auto"
              priority
            />
            <h1 className="font-heading text-xl font-semibold text-primary">
              KHIP HealthLink Platform
            </h1>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="font-heading text-3xl leading-9 font-semibold">
              Staff Portal Login
            </h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Enter your credentials to access the clinical station.
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <div className="mt-12 border-t border-border-subtle pt-8 text-center">
            <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              2026 Hospital Kwadaso - HealthLink
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
