# KHIP System Architecture

Generate a system architecture diagram for the Kwadaso HealthLink Integrated Platform (KHIP).

## Title
KHIP System Architecture

## Description
A hospital management system for SDA Hospital Kwadaso, Ghana. The system handles patient registration, triage, clinical encounters, laboratory, pharmacy, billing, and referrals.

## Architecture

```kroki
@cloud

# Frontend Layer
browser["Browser (React 19)"] as browser

# Application Layer
nextjs["Next.js 16 App Router"] as nextjs
reactquery["TanStack React Query 5"] as reactquery
zustand["Zustand 5 (Client State)"] as zustand
reacthookform["React Hook Form + Zod"] as reacthookform
betterauth["Better Auth 1.6"] as betterauth

# API Layer
apiroutes["Next.js API Routes (/api/*)"] as apiroutes
roleauth["Role-Based Access Control"] as roleauth

# Data Layer
prisma["Prisma 7.8 ORM"] as prisma
postgres["PostgreSQL Database"] as postgres

# UI Layer
tailwind["Tailwind CSS v4"] as tailwind
shadcn["shadcn/ui Components"] as shadcn
lucide["Lucide React Icons"] as lucide

# External
betterauthcloud["Better Auth Cloud (Sessions)"] as betterauthcloud

# Connections
browser --> nextjs
nextjs --> reactquery
nextjs --> zustand
nextjs --> reacthookform
nextjs --> betterauth
nextjs --> apiroutes
apiroutes --> roleauth
roleauth --> prisma
prisma --> postgres
betterauth --> betterauthcloud
nextjs --> tailwind
nextjs --> shadcn
nextjs --> lucide
```

## Layout
top to bottom

## Theme
minimal
