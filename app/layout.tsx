import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter, Manrope } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"
import { privateRobots, siteConfig } from "@/lib/metadata"
import { Providers } from "@/components/providers/providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  keywords: [
    "Kwadaso HealthLink",
    "KHMS",
    "SDA Hospital Kwadaso",
    "hospital management system",
    "patient records",
    "triage",
    "appointments",
    "Ghana healthcare",
  ],
  authors: [{ name: "SDA Hospital Kwadaso" }],
  creator: "SDA Hospital Kwadaso",
  publisher: "SDA Hospital Kwadaso",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
      },
    ],
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: "/",
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.image,
        width: 512,
        height: 512,
        alt: "Kwadaso HealthLink logo",
      },
    ],
    locale: "en_GH",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.image],
  },
  robots: privateRobots,
  category: "healthcare",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#004302",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        inter.variable,
        manrope.variable,
        fontMono.variable
      )}
    >
      <head>
        <meta charSet="utf-8" />
        {/* Prototype icon fonts */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
