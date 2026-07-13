import type { Metadata } from "next"

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

export const siteConfig = {
  name: "Kwadaso HealthLink Integrated Platform",
  shortName: "KHIP",
  title: "KHIP | SDA Hospital Kwadaso",
  description:
    "Secure staff portal for SDA Hospital Kwadaso, covering patient records, appointments, triage, administration, reports, and facility operations.",
  url: siteUrl,
  image: "/android-chrome-512x512.png",
}

export const privateRobots = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
} satisfies Metadata["robots"]

export function sectionMetadata({
  title,
  description,
  path,
  noIndex = true,
}: {
  title: string
  description: string
  path: string
  noIndex?: boolean
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    robots: noIndex ? privateRobots : undefined,
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      images: [
        {
          url: siteConfig.image,
          width: 512,
          height: 512,
          alt: "KHIP logo",
        },
      ],
      locale: "en_GH",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [siteConfig.image],
    },
  }
}
