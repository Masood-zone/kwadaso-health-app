"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Info, Lock, LogIn, Mail, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  FormControl,
  FormItem,
  FormMessage,
} from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const loginSchema = z.object({
  email: z.email("Enter a valid staff email address."),
  password: z.string().min(1, "Password is required."),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackURL = searchParams.get("callbackURL") || "/"
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setFormError(null)

    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: true,
      callbackURL,
    })

    if (result.error) {
      const message =
        result.error.message || "Invalid staff credentials. Please try again."
      setFormError(message)
      toast.error(message)
      return
    }

    router.replace(callbackURL)
    router.refresh()
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <FormItem>
            <Label htmlFor={field.name}>
              Email / Staff ID <span className="text-secondary">*</span>
            </Label>
            <FormControl>
              <Mail className="pointer-events-none absolute top-3.5 left-4 size-4 text-muted-foreground" />
              <Input
                {...field}
                id={field.name}
                type="email"
                autoComplete="email"
                placeholder="superadmin@kwadaso.health"
                className="h-12 pl-11"
                aria-invalid={fieldState.invalid}
              />
            </FormControl>
            <FormMessage>{fieldState.error?.message}</FormMessage>
          </FormItem>
        )}
      />

      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={field.name}>
                Password <span className="text-secondary">*</span>
              </Label>
              <a
                href="/forgot-password"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Forgot Password?
              </a>
            </div>
            <FormControl>
              <Lock className="pointer-events-none absolute top-3.5 left-4 size-4 text-muted-foreground" />
              <Input
                {...field}
                id={field.name}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                className="h-12 pr-12 pl-11"
                aria-invalid={fieldState.invalid}
              />
              <button
                type="button"
                className="absolute top-3 right-3 rounded p-1 text-muted-foreground hover:text-primary"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </FormControl>
            <FormMessage>{fieldState.error?.message}</FormMessage>
          </FormItem>
        )}
      />

      <div className="flex gap-3 rounded-lg border border-primary/10 bg-medical-green-soft p-4 text-sm leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          <strong className="text-foreground">Notice:</strong> Authorized staff
          access only. Every clinical interaction is logged for compliance.
        </p>
      </div>

      {formError ? (
        <div className="rounded-lg border border-destructive/25 bg-emergency-soft px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-14 w-full gap-2 text-base"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ShieldCheck className="size-4 animate-pulse" />
        ) : (
          <LogIn className="size-4" />
        )}
        {isSubmitting ? "Signing in..." : "Sign In to Station"}
      </Button>
    </form>
  )
}
