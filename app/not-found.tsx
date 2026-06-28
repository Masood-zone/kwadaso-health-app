import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Home, SearchX } from "lucide-react"

import { sectionMetadata } from "@/lib/metadata"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = sectionMetadata({
  title: "Page Not Found",
  description: "The requested Kwadaso HealthLink page could not be found.",
  path: "/",
})

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-[var(--topbar-height)] items-center border-b border-border-subtle bg-surface px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded bg-primary-container text-white">
            <SearchX className="size-5" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-primary">KHMS</p>
            <p className="text-xs text-muted-foreground">
              Kwadaso HealthLink
            </p>
          </div>
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center bg-[linear-gradient(#e5eeff_1px,transparent_1px),linear-gradient(90deg,#e5eeff_1px,transparent_1px)] bg-[length:40px_40px] p-4 md:p-8">
        <div className="w-full max-w-xl">
          <div className="khms-card relative overflow-hidden p-8 text-center md:p-10">
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-primary" />
            <div className="mx-auto mb-8 flex size-24 items-center justify-center rounded-full bg-medical-green-soft text-primary">
              <SearchX className="size-12" />
            </div>
            <p className="khms-label text-primary">404 / Page Not Found</p>
            <h1 className="mt-3 font-heading text-3xl font-semibold">
              This KHMS page is unavailable
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
              The page may have moved, the module may not be enabled yet, or the
              address may be incorrect.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-12">
                <Link href="/">
                  <Home className="size-4" />
                  Return Home
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12">
                <Link href="/login">
                  <ArrowLeft className="size-4" />
                  Staff Login
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
