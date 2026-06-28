import type { Metadata } from "next"
import Link from "next/link"
import { HelpCircle, LayoutDashboard, ShieldX, UserCircle } from "lucide-react"

import { sectionMetadata } from "@/lib/metadata"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = sectionMetadata({
  title: "Unauthorized Access",
  description:
    "Unauthorized access notice for protected Kwadaso HealthLink sections.",
  path: "/unauthorized",
})

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-[var(--topbar-height)] items-center justify-between border-b border-border-subtle bg-surface px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="font-heading text-3xl font-bold text-primary">
            KHMS
          </div>
          <span className="hidden font-heading text-xl text-primary/60 sm:block">
            | Kwadaso HealthLink
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Help">
            <HelpCircle className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Account">
            <UserCircle className="size-4" />
          </Button>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center bg-[linear-gradient(#e5eeff_1px,transparent_1px),linear-gradient(90deg,#e5eeff_1px,transparent_1px)] bg-[length:40px_40px] p-4 md:p-8">
        <div className="w-full max-w-xl">
          <div className="khms-card relative overflow-hidden p-8 text-center md:p-10">
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-secondary" />
            <div className="mb-8 inline-flex size-24 items-center justify-center rounded-full bg-emergency-soft text-secondary">
              <ShieldX className="size-12" />
            </div>
            <h1 className="font-heading text-3xl font-semibold">
              Access Restricted
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
              You do not have permission to view this section. This module is
              restricted to authorized clinical or administrative personnel.
            </p>

            <Button asChild className="mt-8 h-12 px-8">
              <Link href="/">
                <LayoutDashboard className="size-4" />
                Return to Dashboard
              </Link>
            </Button>

            <div className="mt-10 border-t border-border-subtle pt-8">
              <p className="khms-label text-secondary">Instructions</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                If you believe this is an error, contact the IT Department or
                System Administrator to review your clinical access level.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between px-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-secondary" />
              System ID: KHMS-SEC-403
            </span>
            <span>Attempt logged</span>
          </div>
        </div>
      </section>
    </main>
  )
}
