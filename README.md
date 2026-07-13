# Kwadaso HealthLink Integrated Platform (KHIP)

A staff-facing hospital management system for **SDA Hospital Kwadaso**, Ghana. KHIP consolidates Electronic Health Records, appointment scheduling, laboratory information management, pharmacy, billing, referrals, and secure messaging into a single, mobile-responsive web application.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Authentication & Roles](#authentication--roles)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Design System](#design-system)
- [Development](#development)

---

## How It Works

KHIP is a **Next.js App Router** application with a layered architecture:

```
Browser/Client → Next.js Pages (Server Components) → Service Layer (TanStack Query hooks) → API Routes → Prisma ORM → PostgreSQL
```

### Request Flow

1. **Authentication**: A staff member logs in with email and password via Better Auth. The server validates credentials and establishes a session cookie.

2. **Route Protection**: Every page calls `requireRolePage()` on the server side. Unauthenticated users are redirected to `/login`. Authenticated users without the correct role are redirected to `/unauthorized`.

3. **Data Fetching**: Client components use **TanStack Query** hooks defined in `services/` to fetch data from API routes. An Axios instance with a 401 interceptor handles session expiry by redirecting to `/session-expired`.

4. **API Layer**: API routes live in `app/api/` and call `requireRoleApi()` to verify the requesting user has the required role(s) before executing business logic and returning data.

5. **Database**: All persistence goes through **Prisma ORM** with a PostgreSQL driver adapter. The schema models the full hospital domain — patients, encounters, prescriptions, lab orders, invoices, and more.

### Typical Workflow (Triage → Consultation → Pharmacy → Billing)

```
Patient arrives
  → Records Officer registers patient / looks up existing record
  → Nurse captures vitals (blood pressure, temperature, weight, etc.) in Triage
  → Patient enters the queue for Doctor consultation
  → Doctor creates an Encounter, writes SOAP notes, orders labs, prescribes medication
  → Lab Technician processes the request, records results → linked to patient EHR
  → Pharmacist dispenses prescribed medication → stock updated automatically
  → Billing Officer generates an invoice → payment recorded
  → If needed, Doctor creates a Referral to another facility/department
  → Patient receives a summary; all data is available for future visits
```

---

## Features

| Module | Description | Status |
|---|---|---|
| **Authentication** | Email/password login, session management, role-based access control | Implemented |
| **Super Admin** | Staff CRUD, role & permission management, department management, hospital settings, audit logs | Implemented |
| **Hospital Admin** | Patient flow, departments, appointments, queue, billing, staff, oversight, notifications, audit logs, settings, reports | Implemented |
| **Records Officer** | Patient registration, search, profile, visit history, timeline, documents, appointments, check-in, queue, duplicate detection, print/export | Implemented |
| **Nurse/Triage** | Triage queue, vital signs capture & history, emergency flagging, immunizations, queue board, notifications | Implemented |
| **Clinical Encounters** | SOAP notes, diagnoses, treatment plans | Schema ready |
| **Laboratory (LIMS)** | Test requests, sample tracking, result entry, EHR linkage | Schema ready |
| **Pharmacy** | Prescriptions, dispensing, medication stock management, stock movements | Schema ready |
| **Billing & Payments** | Invoicing, payment tracking, partial payments | Schema ready |
| **Referrals** | Inter-facility and inter-department referrals | Schema ready |
| **Messaging** | Secure, audit-trailed internal messaging between staff | Schema ready |
| **Reporting & HMIS** | Morbidity reports, immunization coverage, data export | Schema ready |
| **Offline Sync** | Offline job queue for unreliable connectivity | Schema ready |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| State & Data | TanStack React Query 5, Zustand 5 |
| Forms | React Hook Form + Zod validation |
| Authentication | Better Auth 1.6 |
| ORM | Prisma 7.8 (PostgreSQL driver adapter) |
| Database | PostgreSQL |
| HTTP Client | Axios |
| Icons | Lucide React |
| Notifications | Sonner (toast) |
| Theme | next-themes (dark/light mode) |
| Package Manager | pnpm |

---

## Project Structure

```
kwadaso-health-app/
├── app/
│   ├── api/                         # API route handlers
│   │   ├── auth/[...all]/           # Better Auth endpoints
│   │   ├── hospital-admin/          # Hospital admin API (dashboard, CRUD, queue, etc.)
│   │   ├── nurse/                   # Nurse/triage API (queue, vitals, immunizations)
│   │   ├── records-officer/         # Records officer API (patients, appointments, queue)
│   │   └── super-admin/             # Super admin API (staff, roles, departments)
│   ├── login/                       # Login page
│   ├── super-admin/                 # Super admin pages
│   ├── hospital-admin/              # Hospital admin pages
│   ├── nurse/                       # Nurse/triage pages
│   ├── records-officer/             # Records officer pages
│   ├── unauthorized/                # Unauthorized access page
│   └── session-expired/             # Session expiry page
├── assets/
│   └── designs/                     # UI mockups (HTML + PNG) by role
├── components/
│   ├── auth/                        # Login form, auth providers
│   ├── common/                      # Shared layout components
│   ├── dashboard/                   # Dashboard shell with sidebar nav
│   ├── hospital-admin/              # Hospital admin UI components
│   ├── nurse/                       # Nurse/triage UI components
│   ├── records-officer/             # Records officer UI components
│   ├── providers/                   # React Query, theme, session providers
│   ├── super-admin/                 # Super admin UI components
│   └── ui/                          # shadcn/ui primitives
├── lib/
│   ├── auth.ts                      # Better Auth server instance
│   ├── auth-client.ts               # Better Auth React client
│   ├── auth-session.ts              # Session guards: requireStaffPage, requireRoleApi
│   ├── axios.ts                     # Axios instance with 401 interceptor
│   ├── hospital-admin.ts            # Hospital admin business logic
│   ├── nurse.ts                     # Nurse business logic
│   ├── records-officer.ts           # Records officer business logic
│   ├── super-admin.ts               # Super admin business logic
│   ├── prisma.ts                    # Prisma client singleton
│   ├── role-routes.ts               # Role → dashboard route mapping
│   └── utils.ts                     # Utility functions (cn, etc.)
├── prisma/
│   ├── schema.prisma                # Database schema (40+ models)
│   ├── seed-admins.ts               # Seed script (facility, staff, demo data)
│   └── migrations/                  # Migration history
├── services/
│   ├── hospital-admin/              # TanStack Query hooks for hospital admin
│   ├── nurse/                       # TanStack Query hooks for nurse/triage
│   ├── records-officer/             # TanStack Query hooks for records officer
│   └── super-admin/                 # TanStack Query hooks for super admin
├── types/
│   ├── api.ts                       # ApiResponse<T>, PaginatedResponse<T>
│   ├── dashboard.ts                 # Shared dashboard data types
│   ├── hospital-admin.ts            # Hospital admin types
│   ├── nurse.ts                     # Nurse types
│   ├── records-officer.ts           # Records officer types
│   └── super-admin.ts              # Super admin types
└── public/                          # Static assets
```

---

## Database Schema

The schema contains **40+ models** organized into these domain areas:

### Access Control
`User` · `Role` · `Permission` · `UserRole` · `RolePermission` · `Session` · `Account` · `Verification`

### Facilities & Departments
`Facility` · `Department`

### Patient Records
`Patient` · `PatientAllergy` · `ChronicCondition` · `MedicationHistory` · `PatientDocument` · `ImmunizationRecord`

### Clinical Workflow
`Appointment` · `PatientQueue` · `VitalSigns` · `Encounter` · `ClinicalNote` (SOAP) · `Diagnosis`

### Laboratory
`LabTestCatalog` · `LabRequest` · `LabRequestTest` · `LabSample` · `LabResult` · `LabResultItem`

### Pharmacy
`Medication` · `Prescription` · `PrescriptionItem` · `MedicationStock` · `StockMovement` · `Dispensing` · `DispenseItem`

### Billing
`Invoice` · `InvoiceItem` · `Payment`

### Communication
`Referral` · `MessageThread` · `MessageParticipant` · `Message` · `Notification`

### System
`ReportExport` · `AuditLog` · `OfflineSyncJob` · `SystemSetting`

---

## Authentication & Roles

KHIP uses **Better Auth** with email/password authentication. Every user is assigned a role that determines what they can access.

### Staff Roles

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Full system access — staff management, roles, permissions, departments, settings, audit logs |
| `HOSPITAL_ADMIN` | Hospital-level dashboards, department workload, staff activity |
| `MUNICIPAL_HEALTH_DIRECTOR` | Cross-facility oversight and reporting |
| `M_AND_E_OFFICER` | Monitoring, evaluation, HMIS data |
| `RECORDS_OFFICER` | Patient registration, records management |
| `FRONT_DESK` | Patient check-in, appointment management |
| `DOCTOR` | Clinical encounters, SOAP notes, diagnoses, prescriptions, referrals |
| `PHYSICIAN_ASSISTANT` | Clinical encounters (supervised) |
| `NURSE` | Triage, vital signs capture, nursing notes |
| `LAB_TECHNICIAN` | Lab requests, sample tracking, result entry |
| `PHARMACIST` | Prescriptions, dispensing, stock management |
| `BILLING_OFFICER` | Invoicing, payment processing |

### How Route Protection Works

- **Server pages**: Each layout calls `requireRolePage(pathname, allowedRoles)`. If the user is not authenticated or lacks the required role, they are redirected.
- **API routes**: Each handler calls `requireRoleApi(request, allowedRoles)`. Unauthorized requests receive a 401 response.
- **Client Axios**: The Axios instance intercepts 401 responses and redirects to `/session-expired`.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (v22 recommended)
- **pnpm** 9+
- **PostgreSQL** 14+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd kwadaso-health-app

# Install dependencies
pnpm install
```

### Database Setup

```bash
# Create a PostgreSQL database, then set DATABASE_URL in .env
# Run migrations
pnpm prisma migrate dev

# Seed the database with facility, departments, staff, and demo data
pnpm seed
```

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/khip?schema=public"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

### Run the Application

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Default Seed Accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@kwadaso.health` | `ChangeMe123!` |
| Hospital Admin | `hospitaladmin@kwadaso.health` | `ChangeMe123!` |
| Records Officer | `recordofficer@kwadaso.health` | `ChangeMe123!` |
| Nurse | `nurse@kwadaso.health` | `ChangeMe123!` |

> **Important**: Change these passwords immediately in production.

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm seed` | Seed the database with initial data |
| `pnpm prisma migrate dev` | Run database migrations |
| `pnpm prisma studio` | Open Prisma Studio (visual database browser) |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL for API requests (default: `http://localhost:3000/api`) |
| `BETTER_AUTH_SECRET` | No | Secret key for Better Auth session signing |
| `BETTER_AUTH_URL` | No | Base URL for Better Auth callbacks |

---

## Design System

KHIP uses a Material Design 3 inspired token system with a custom **KHIP** layer:

- **Primary palette**: Deep forest green (`#004302`) with green containers
- **Emergency/Accent**: Red tones for alerts and urgent states
- **Dark mode**: Deep navy tones with full dark mode support
- **Typography**: Inter for body text, Manrope for headings
- **Layout**: Sidebar navigation (260px) with topbar (64px), max content width 1440px
- **Custom utilities**: `.khms-card`, `.khms-badge`, `.khms-label`, `.khms-input`, `.khms-table-data`

---

## Development

### Architecture Principles

1. **Thin pages, rich components**: Server pages handle auth guards only. All UI logic lives in domain components under `components/`.
2. **Service layer isolation**: All client-side data fetching goes through TanStack Query hooks in `services/`. Components never call API routes directly.
3. **Role-based organization**: Components, services, and types are organized by role (`super-admin/`, `hospital-admin/`, `records-officer/`, `nurse/`) for clear boundaries.
4. **Shared primitives**: `components/ui/` contains reusable shadcn/ui components. `components/common/` holds shared layout pieces.

### Adding a New Role Dashboard

1. Add the role to `StaffRole` enum in `prisma/schema.prisma` and migrate
2. Create page under `app/[role]/dashboard/page.tsx` with `requireRolePage()` guard
3. Create components under `components/[role]/`
4. Create service hooks under `services/[role]/`
5. Create API routes under `app/api/[role]/`
6. Add types under `types/[role].ts`
7. Update the role-route mapping in `lib/role-routes.ts`

---

## Project Team

| Name | Role | Index Number |
|---|---|---|
| Agyapong Brenya Gideon | Project Lead & Backend Developer | 5221040054 |
| Nutakor Emmanuel | Lead Frontend Developer & UI/UX | 5221040051 |
| Awuah Comfort | Systems Analyst & QA Specialist | 5221040056 |

**Supervisor**: Dr. Victor Dela Tattrah

**Institution**: Akenten Appiah Menka University of Skills Training and Entrepreneurial Development ( Faculty of Applied Science and Mathematics Technology)

**Degree**: BSc Information Technology Education

---

## License

This project is proprietary to the Kwadaso Municipal Health Directorate. For inquiries, contact the project team.
