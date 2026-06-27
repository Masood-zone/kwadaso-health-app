import Image from "next/image"
import Link from "next/link"
import { Lock, LogIn, Shield, TimerOff } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function SessionExpiredPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-app-bg p-4 text-foreground md:p-8">
      <section className="w-full max-w-[480px]">
        <div className="khms-card relative overflow-hidden p-8 text-center md:p-10">
          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-pending-soft" />
          <div className="absolute top-0 left-0 h-1/3 w-1.5 bg-secondary-container" />
          <div className="mb-10 flex flex-col items-center">
            <Image
              src="/logo.png"
              alt="SDA Hospital Kwadaso"
              width={96}
              height={96}
              className="mb-6 h-20 w-auto"
              priority
            />
            <h1 className="font-heading text-4xl font-bold text-primary">
              KHMS
            </h1>
            <p className="khms-label mt-1">Kwadaso HealthLink</p>
          </div>

          <div className="mb-8">
            <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-emergency-soft text-secondary">
              <TimerOff className="size-8" />
            </div>
            <h2 className="font-heading text-3xl font-semibold">
              Session Expired
            </h2>
            <p className="mx-auto mt-3 max-w-[320px] text-base leading-6 text-muted-foreground">
              Your session has timed out due to inactivity to protect patient
              privacy.
            </p>
          </div>

          <div className="mb-8 rounded-lg border border-border-subtle bg-background p-4 text-left">
            <div className="flex gap-4">
              <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="khms-label text-foreground">Security Protocol</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Automatic logout keeps unattended clinical stations secure.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button asChild className="h-12 w-full">
              <Link href="/login">
                <LogIn className="size-4" />
                Login Again
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 w-full">
              <Link href="/unauthorized">Support Desk</Link>
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border-subtle pt-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Lock className="size-4" />
              Secure Terminal
            </span>
            <span>ID: 01-KW-7742</span>
          </div>
        </div>
      </section>
    </main>
  )
}
