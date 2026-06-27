# Amanah Welfare System Project Structure

This document explains how the Amanah Welfare System was developed so another Codex run can reuse the same architecture for a similar multi-role Next.js application. It is based on the actual repository layout, not only the README summary.

## 1. Architectural Shape

Amanah is a Next.js 16 App Router application built around three protected product surfaces:

- `member/`: member self-service portal for programs, contributions, payments, notifications, and profile.
- `organizer/`: organization admin workspace for dashboard analytics, welfare programs, member management, batch upload, and settings.
- `super-admin/`: platform operator console for organizations, applications, settings, and global analytics.

The app follows a layered pattern:

1. `app/*` defines routes, layouts, server route protection, and API endpoints.
2. `components/*` contains the actual UI screens and reusable UI primitives.
3. `services/*` contains client-side API wrappers, TanStack Query hooks, and server-side business workflows such as notifications/reminders.
4. `lib/*` contains cross-cutting infrastructure: auth setup, Prisma client, API clients, role guards, payments, formatting, and utilities.
5. `types/*` defines API response contracts and role-specific data shapes.
6. `prisma/*` defines the domain model, migrations, and admin seeding.
7. `assets/designs/*` preserves source HTML/screenshots used as implementation references for the product UI.

Pages are intentionally thin. Most `page.tsx` files import and render one domain component, while route layouts enforce role access and attach the proper shell.

## 2. Stack and Package Choices

Core stack from `package.json`:

- Next.js `16.2.6` and React `19.2.4`.
- Prisma `7.8.0` with PostgreSQL and `@prisma/adapter-pg`.
- Better Auth `1.6.16`.
- TanStack Query `5.x` for server state.
- Tailwind CSS v4, Shadcn/ui, Base UI primitives, CVA, and `tailwind-merge`.
- React Hook Form and Zod for forms and validation.
- Paystack Inline JS and server-side Paystack REST calls for payments.
- Nodemailer and React Email for email notifications.
- Cloudinary and `react-dropzone` for upload flows.
- `xlsx` for member batch upload.

Development commands:

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
pnpm seed:admins
```

The Prisma generator outputs the client to `app/generated/prisma`, and imports must use that generated path, for example `@/app/generated/prisma/enums`.

## 3. Route Layouts and Pages

### Root App

- `app/layout.tsx` loads global fonts, metadata, manifest/icons, Material Symbols styles, global CSS, and `Providers`.
- `app/page.tsx` renders the public marketing/home page using `components/home/*`.
- `app/error.tsx` and `app/not-found.tsx` provide global fallback screens.
- `app/globals.css` defines the "Rooted Warmth" design tokens and Tailwind v4 theme variables.

### Auth Routes

Public auth and onboarding pages live under `app/(auth)/`:

- `login/page.tsx`
- `forgot-password/page.tsx`
- `reset-password/page.tsx`
- `organization/onboarding/details/page.tsx`
- `organization/onboarding/brand-assets/page.tsx`
- `organization/onboarding/review/page.tsx`

These pages use components from `components/auth/*` and `components/onboarding/*`. Forms use React Hook Form + Zod, Better Auth client methods, and the onboarding service.

### Member Routes

Member routes live under `app/member/`.

- `layout.tsx` is a server component that calls `auth.api.getSession()` and redirects unauthenticated users to `/login?callbackURL=/member/dashboard`.
- It only allows `Role.MEMBER`; other roles are redirected to `/`.
- The layout wraps pages with `components/member/member-shell.tsx`.

Member pages include:

- `dashboard`
- `programs`
- `programs/[programId]`
- `contributions`
- `payment-history`
- `payments`
- `notifications`
- `profile`

Each page delegates to a `components/member/*-content.tsx` component.

### Organizer Routes

Organizer routes live under `app/organizer/`.

- `layout.tsx` checks the Better Auth session.
- It permits `Role.ADMIN` and `Role.SUPER_ADMIN`.
- It wraps content in the shared `DashboardShell` with `role="organizer"`.

Organizer pages include:

- `dashboard`
- `programs`
- `programs/create`
- `members`
- `members/[memberId]`
- `members/batch-upload`
- `settings`

The UI lives in `components/organizer/*`.

### Super Admin Routes

Super admin routes live under `app/super-admin/`.

- `layout.tsx` checks the Better Auth session.
- It only permits `Role.SUPER_ADMIN`.
- It wraps content in `DashboardShell` with `role="super-admin"`.

Super admin pages include:

- `dashboard`
- `applications`
- `organizations`
- `organizations/[organizationId]`
- `settings`

The UI lives in `components/super-admin/*`.

## 4. API Route Organization

All backend endpoints live under `app/api/`.

### Auth

- `app/api/auth/[...all]/route.ts` exposes Better Auth through `toNextJsHandler(auth)`.
- Auth configuration is in `lib/auth.ts`.
- Client auth helpers are in `lib/auth-client.ts` and `services/auth/user-auth.ts`.

### Member API

Member endpoints use `requireMember(request)` from `lib/member-api.ts`.

Routes:

- `GET /api/member/dashboard`
- `GET /api/member/programs`
- `GET /api/member/programs/:programId`
- `POST /api/member/programs/:programId/enroll`
- `GET /api/member/contributions`
- `GET/PATCH /api/member/notifications`
- `GET/PATCH /api/member/profile`
- `POST /api/member/payments/initialize`
- `POST /api/member/payments/verify`

Pattern:

1. Call `await connection()` for dynamic API behavior where used.
2. Call `requireMember(request)`.
3. Return the guard response early if present.
4. Query Prisma with organization/member scoping.
5. Shape Decimal/Date values into JSON-safe numbers and ISO strings.
6. Return `{ success, data, message }`.
7. Catch and log server errors, then return a safe error message.

### Organizer API

Organizer endpoints use `requireOrganizer(request)` from `lib/organizer-api.ts`.

Routes:

- `GET /api/organizer/dashboard`
- `GET/POST /api/organizer/programs`
- `PATCH /api/organizer/programs/:programId`
- `GET/POST /api/organizer/members`
- `GET/PATCH /api/organizer/members/:memberId`
- `POST /api/organizer/members/batch-upload`
- `GET/PATCH /api/organizer/settings`

Pattern:

- Validate request bodies with Zod.
- Scope all records to the active organization from `requireOrganizer`.
- Use Prisma transactions when multiple writes must stay consistent.
- Write audit logs for important organizer actions.
- Trigger notification helpers after core writes, keeping external delivery failures non-blocking.

### Super Admin API

Super admin endpoints use `requireSuperAdmin(request)` from `lib/super-admin-api.ts`.

Routes:

- `GET /api/super-admin/dashboard`
- `GET /api/super-admin/applications`
- `PATCH /api/super-admin/applications/:organizationId/decision`
- `GET /api/super-admin/organizations`
- `GET/PATCH /api/super-admin/organizations/:organizationId`
- `PATCH /api/super-admin/organizations/:organizationId/suspend`
- `GET/PATCH /api/super-admin/settings`

Pattern:

- Super admin APIs are separate from organizer APIs even when they touch the same models.
- Organization approval/rejection updates organization status, membership status, audit logs, and sends notification email/SMS best-effort.
- Application status is derived from `OrganizationStatus`: `INACTIVE` as pending, `ACTIVE` as approved, `SUSPENDED` as rejected/suspended.

### Other APIs

- `POST /api/organization-onboarding`: public organization application flow. Creates or updates an inactive organization, creates/admin-updates the admin user through Better Auth, creates membership, creates notification, and sends email/SMS best-effort.
- `POST /api/uploads`: handles upload integration.
- `GET /api/cron/welfare-due-reminders`: protected by `CRON_SECRET` in production and calls `processWelfareProgramDueReminders()`.

## 5. Components

Components are split by reuse level and product domain.

### `components/ui`

Shadcn/Base UI primitives live here:

- `button.tsx`
- `input.tsx`
- `label.tsx`
- `textarea.tsx`
- `select.tsx`
- `checkbox.tsx`
- `dropdown-menu.tsx`
- `card.tsx`
- `avatar.tsx`
- `accordion.tsx`

The components use `cn()` from `lib/utils.ts` and Rooted Warmth tokens from `globals.css`. `button.tsx` uses Base UI's button primitive with CVA variants.

### `components/providers`

- `providers.tsx`: wraps the app with `ThemeProvider`, `PwaProvider`, TanStack `QueryClientProvider`, and Sonner `Toaster`.
- `theme-provider.tsx`: Next Themes setup.
- `pwa-provider.tsx`: client-side PWA registration behavior.

### `components/dashboard`

Shared dashboard shell/nav for organizer and super admin.

- `dashboard-shell.tsx` owns sidebar navigation, mobile nav, header search, logout, and role-specific nav items.
- `dashboard-nav.tsx` is an alternate reusable nav primitive using Material Symbols.

### `components/member`

Member portal screens and widgets:

- `member-shell.tsx`
- `member-dashboard-content.tsx`
- `member-programs-content.tsx`
- `member-program-detail-content.tsx`
- `member-contributions-content.tsx`
- `member-payments-content.tsx`
- `member-pay-now-button.tsx`
- `member-notifications-content.tsx`
- `member-profile-content.tsx`

Client components call hooks from `services/member/member.ts`.

### `components/organizer`

Organizer workspace screens:

- dashboard, programs, create program, members, member detail, batch upload, settings.
- Program and member workflows use service hooks from `services/organizer/*`.

### `components/super-admin`

Super admin screens:

- applications, organizations, organization detail, settings.
- These use hooks from `services/super-admin/*`.

### `components/onboarding`

Multi-step organization onboarding UI:

- shell/top bar/stepper.
- details form.
- brand assets form.
- review/submit form.
- field and section helpers.

### `components/auth`, `components/home`, `components/common`

- `auth`: login, forgot password, reset password, user avatar/menu.
- `home`: public landing page sections.
- `common`: shared primitives such as `MaterialSymbol`, file upload, and status pages.

## 6. Services

This project uses `services/*` for two related concerns:

1. Client-side request functions and TanStack Query hooks.
2. Server-side business workflows that are not route-specific.

### Client Request Services

Examples:

- `services/member/member.ts`
- `services/organizer/dashboard.ts`
- `services/organizer/programs.ts`
- `services/organizer/members.ts`
- `services/organizer/settings.ts`
- `services/super-admin/dashboard.ts`
- `services/super-admin/applications.ts`
- `services/super-admin/organizations.ts`
- `services/super-admin/settings.ts`
- `services/organization-onboarding/organization-onboarding.ts`

Pattern:

```ts
export async function getSomething() {
  try {
    const res = await api.get<ApiResponse<SomethingData>>("/namespace/path")

    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Something could not be loaded")
    }

    return res.data.data
  } catch (error) {
    throw toApiClientError(error, "Something could not be loaded")
  }
}

export function useSomething() {
  return useQuery({
    queryKey: ["namespace", "something"],
    queryFn: getSomething,
  })
}
```

Mutation hooks invalidate the related query keys after success.

### Notification and Integration Services

- `services/email/*`: React Email templates and `email-service.ts`.
- `services/sms/sms-service.ts`: SMS delivery adapter.
- `services/notifications/*`: higher-level notification workflows for enrollment, payment success, and due reminders.
- `services/welfare-program-due-reminders.ts`: scheduled reminder calculation and delivery.
- `services/uploads/uploads.ts`: upload-facing service logic.
- `services/organizer/mandatory-welfare-enrollments.ts`: automatically enrolls active members when an organizer creates an active mandatory welfare program.

External channel failures are usually caught and logged so core database actions can still succeed.

## 7. Lib Layer

`lib/*` is infrastructure and cross-cutting logic.

- `lib/prisma.ts`: singleton Prisma client using `PrismaPg` and `DATABASE_URL`.
- `lib/auth.ts`: Better Auth server config, Prisma adapter, email/password auth, and custom user fields such as `role`.
- `lib/auth-client.ts`: Better Auth React client.
- `lib/axios.ts`: browser API client with base URL `/api`, credentials, JSON headers, and 401 redirect behavior.
- `lib/api-client-error.ts`: normalizes API/axios errors for UI hooks.
- `lib/member-api.ts`: `requireMember()` role and active membership guard.
- `lib/organizer-api.ts`: `requireOrganizer()` role and active organization guard.
- `lib/super-admin-api.ts`: `requireSuperAdmin()` role guard.
- `lib/member-program-status.ts`: payment/due-state calculation helper.
- `lib/dashboard-paths.ts`: maps auth role to dashboard route.
- `lib/paystack/paystack.ts`: server-side Paystack initialize/verify requests and amount conversion.
- `lib/cloudinary/*`: Cloudinary upload utility/service.
- `lib/utils.ts`: `cn`, formatting helpers, organization status helpers, temporary password generation, and transient retry utilities.

## 8. Types

`types/index.ts` defines the shared API envelope:

```ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  code?: string
}
```

Role-specific type files mirror service/API boundaries:

- `types/member.ts`
- `types/organizer.ts`
- `types/super-admin-dashboard.ts`
- `types/super-admin-applications.ts`
- `types/super-admin-organizations.ts`
- `types/super-admin-settings.ts`

Types import Prisma enums from `@/app/generated/prisma/enums`, which keeps client/server contracts aligned with the schema.

`types/paystack-inline-js.d.ts` provides a browser declaration for Paystack Inline JS.

## 9. Prisma Domain Model

The database models are:

- `Organization`
- `User`
- `OrganizationMember`
- `WelfareProgram`
- `MemberEnrollment`
- `Contribution`
- `Notification`
- `WelfareProgramDueReminder`
- `AuditLog`
- Better Auth tables: `Session`, `Account`, `Verification`

Important enums:

- `Role`: `SUPER_ADMIN`, `ADMIN`, `COLLECTOR`, `MEMBER`.
- `OrganizationStatus`: `ACTIVE`, `SUSPENDED`, `INACTIVE`.
- `WelfareProgramFrequency`: weekly through yearly.
- `WelfareProgramEnrollmentType`: `MANDATORY`, `OPTIONAL`.
- `EnrollmentStatus`, `ContributionStatus`, `NotificationType`, and reminder status enums.

Schema conventions:

- Soft deletion uses `deletedAt` across core tables.
- Membership is unique by `[organizationId, userId]`.
- Contributions are linked to both user and welfare program.
- Reminder records are unique by `[memberId, welfareProgramId, dueAt]`.
- Audit logs store action strings plus JSON metadata.
- Better Auth maps tables to `user`, `session`, `account`, and `verification`.

## 10. State Management

There is no active global client store in `stores/`; it is currently empty. The app relies on:

- TanStack Query for server state.
- Local React state for form UI, modals, mobile nav, and loading flags.
- Better Auth session state via server checks and the Better Auth client.

When building another project from this structure, only add Zustand or another store if a truly shared client-only state concern appears. Prefer TanStack Query for all API-backed data.

## 11. Styling and Design System

The design system is documented in `DESIGN.md` and implemented in `app/globals.css`.

Core identity:

- "Rooted Warmth": calm, grounded, human.
- Forest green primary, warm cream backgrounds, amber accents, and warm neutral borders.
- Fonts: Literata for headings and Nunito Sans for body text.
- Soft elevation through `--elevation-soft`.
- Rounded, spacious UI with low-contrast tonal layering.

Implementation rules:

- Use Tailwind tokens from `globals.css`.
- Use `cn()` for conditional classes.
- Use reusable `components/ui/*` primitives rather than ad hoc inputs/buttons.
- Use lucide icons and Material Symbols consistently with existing components.
- Use source screenshots/HTML in `assets/designs/*` when implementing screens that have mocks.

## 12. Data Flow Example

Member dashboard flow:

1. `app/member/dashboard/page.tsx` renders `MemberDashboardContent`.
2. `MemberDashboardContent` calls `useMemberDashboard()` from `services/member/member.ts`.
3. The hook calls `GET /api/member/dashboard` through `lib/axios.ts`.
4. `app/api/member/dashboard/route.ts` calls `requireMember(request)`.
5. The route queries Prisma for programs, contributions, reminders, and notifications.
6. The route converts Decimal values to numbers and Dates to ISO strings.
7. The UI renders loading, error, empty, and populated states.

Organizer program creation flow:

1. UI submits a create-program form.
2. `useCreateOrganizerProgram()` posts to `/api/organizer/programs`.
3. The route validates with Zod.
4. `requireOrganizer()` scopes the operation to the active organization.
5. Prisma creates the program.
6. If the program is active and mandatory, `enrollActiveMembersInMandatoryProgram()` enrolls current active members.
7. The route writes an audit log.
8. The service invalidates `["organizer", "programs"]` and `["organizer", "dashboard"]`.

Organization onboarding flow:

1. Public onboarding form submits to `services/organization-onboarding`.
2. `POST /api/organization-onboarding` validates the payload.
3. The route creates or updates an inactive organization.
4. It creates or updates an admin user through Better Auth/Prisma.
5. It creates an inactive admin organization membership.
6. It creates an in-app notification.
7. It sends email and SMS best-effort.
8. Super admin later approves or rejects through `/api/super-admin/applications/:organizationId/decision`.

## 13. Replication Blueprint for Another Project

To build a similar app from this structure:

1. Start with Next.js App Router and define route groups by product role or audience.
2. Put role checks in server `layout.tsx` files, not only in client components.
3. Keep pages thin and move real screens into `components/<domain>`.
4. Create `lib/<role>-api.ts` guards for every protected API namespace.
5. Use a consistent API envelope: `{ success, data, message, errors }`.
6. Put request wrappers and TanStack Query hooks in `services/<domain>`.
7. Put server business workflows in `services/*` when they are reused or too large for a route.
8. Define all API response shapes in `types/*`.
9. Keep Prisma enums as the source of truth for roles/statuses.
10. Convert Prisma Decimal and Date values before returning JSON.
11. Use Zod in API routes for all mutations.
12. Use transactions and audit logs around multi-write administrative actions.
13. Keep external integrations best-effort unless the external result is the core outcome.
14. Centralize payments behind `lib/payments/*` or provider-specific modules.
15. Preserve design tokens in global CSS and use shared UI primitives consistently.

## 14. Guardrails for Future Codex Work

- Always import Prisma client/enums from `@/app/generated/prisma`.
- Do not bypass `requireMember`, `requireOrganizer`, or `requireSuperAdmin` in protected API routes.
- Do not put API-backed state in global stores; use TanStack Query.
- Keep role dashboards reachable through visible nav and server layout redirects.
- Keep page files small; add domain content components.
- Keep service hooks and type contracts in sync with API route response shapes.
- Use `pnpm typecheck` and `pnpm lint` after meaningful changes.
- Never commit `.env` or secrets.
- Use `assets/designs/*` and `DESIGN.md` as UI source material before inventing new screen layouts.
