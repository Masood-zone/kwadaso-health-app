import type { Metadata } from "next"

import { sectionMetadata } from "@/lib/metadata"

export const metadata: Metadata = sectionMetadata({
  title: "Staff Authentication",
  description:
    "Secure sign-in and account access pages for KHIP staff.",
  path: "/login",
})

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
