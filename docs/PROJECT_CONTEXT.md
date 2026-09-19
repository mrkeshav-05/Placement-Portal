# Canonical Project Context

Last updated: 2026-09-17

## Product

The IIIT Lucknow Training & Placement Portal serves two roles:

- Students discover opportunities, maintain profiles and resumes, apply, track outcomes, submit feedback, request NOCs, browse and share moderated interview experiences, and access placement resources.
- Administrators manage announcements, companies, events (the drives, stored as `JobProfile`), applications, students, feedback, NOCs, team members, administrators, and placement analytics.

## Current architecture

The repository is split into three services, each with its own container, alongside PostgreSQL and a Redis cache.

| Directory | Role |
|---|---|
| `frontend/` | Next.js 16 App Router, React 19, strict TypeScript. UI, routing, session handling. |
| `backend/` | FastAPI + SQLAlchemy 2 + Pydantic 2 on Python 3.12. Owns application data access. |
| `database/` | Prisma 6 schema, migrations, and seed. Owns the database structure. |

- `frontend` and `database` are npm workspaces sharing one lockfile at the repository root. A single Prisma schema cannot resolve a client across two independent `node_modules` trees, so do not give either package its own lockfile.
- Tailwind CSS 4 plus repository-owned CSS in `frontend/src/app/globals.css` and `admin.css`
- Auth.js v5 beta with one credentials provider and JWT sessions; no OAuth provider
- Zod for validation in the frontend, Pydantic in the backend
- Lucide for icons
- shadcn/ui (new-york, `frontend/src/components/ui`) for every form control, dialog, and status banner on both sides of the portal, pointed at the repository's semantic tokens by the `@theme inline` bridge in `globals.css`. The admin data tables are the one part not on it: `DataTable` keeps its own CSS. The hand-written stylesheets still supply page shells, and they sit in `@layer components` so a utility at the call site outranks them — see the 2026-09-18 entry in `docs/DECISIONS.md` before adding a rule to either file
- `cmdk` for the searchable recruiter picker and `react-day-picker` for the event deadline calendar; both are behaviour only, styled from the repository's own tokens, and neither stylesheet is imported
- Node's test runner with `tsx` for frontend units; pytest for the backend
- Redis (the `cache` Compose service) in front of the announcement and event read endpoints, through `backend/app/core/cache.py`. It is optional by construction: an empty `REDIS_URL`, an unreachable server, or a timeout all fall through to Postgres and return the same answer. Nothing is stored there that one query cannot rebuild, so it has no volume. See the 2026-09-20 entry in `docs/DECISIONS.md` before caching anything else, particularly the rule that the viewer belongs in the key
- Docker Compose for the full stack, with a hot-reload override

See `docs/DECISIONS.md` (2026-08-20) for why data access moved to FastAPI while Prisma kept the schema.

## Data ownership

`database/prisma/schema.prisma` is authoritative for the database structure. The SQLAlchemy models in `backend/app/models/db.py` mirror it and must never call `Base.metadata.create_all()` or otherwise migrate. Any schema change is a Prisma migration plus a matching model update.

Main entities: User, Account, Session, Company, JobProfile, Application, Offer, Announcement, Feedback, NocRequest, InterviewExperience, Resume, Coordinator, TeamMember, Notification.

Important invariants:

- One application per student/job profile.
- Company names, user emails, and student roll numbers are unique where present.
- A `Company` is the recruiter, registered at `/admin/companies/add`. Its `category` is `Dream` or `First Round` from `frontend/src/lib/company-schema.ts` and records the round the company recruits in; nothing evaluates it yet. `placementSession` is the season the record was raised for, and `turnover` is quoted as the company states it. `website` and `logoUrl` are still stored and still shown to students, but no screen edits them.
- A `JobProfile` is the company event the admin portal composes at `/admin/events`. Its `placementYear` is the season the drive runs in and its `batch` is the graduating cohort it recruits; the two are not interchangeable. `jobCategory` is one of the four values in `frontend/src/lib/job-profile-schema.ts`, and `cap`, `companyBond`, and `duration` are quoted from the company as free text rather than parsed figures.
- Job eligibility is evaluated from the student's current profile and job criteria: CGPA, batch, branch, degree, gender, backlogs, placement bans, and document completeness. An empty `allowedDegrees` or `allowedGenders` list, or one holding `all`/`any`, places no restriction; a restriction the profile cannot answer fails.
- `NocRequest.message` is the student's remarks and `NocRequest.adminRemarks` is the placement cell's decision remarks. A decision never writes over the student's text.
- An `Offer` is the placement record and the only source of package figures. An application is not an offer; the two are joined by an optional, unique `applicationId`. An FTE or PPO carries `ctc`, an internship carries `stipend`, and the type the offer is not clears the other. A `DECLINED` or `REVOKED` offer stays on file but is excluded from every statistic, a rule stated once in `COUNTED_OFFER_STATUSES`. The season is the batch stored on the offer, not the student's current batch.
- An `Announcement` is `DRAFT` or `PUBLISHED`, defaulting to `PUBLISHED`; drafts are filtered out server-side for anyone without `announcements.view`, and the single-announcement route answers 404 for them. `publishedAt` keeps the first publication date through a withdraw and re-publish. A company event may name the drive it is about in `jobProfileId`; a general notice carries neither company nor drive. Attachments are `AnnouncementAttachment` rows; their type is verified against the file's signature rather than its name, and a draft's files are as private as the draft.
- Sensitive Aadhaar, PAN, and college-ID fields contain encrypted payloads, not plaintext. Each number doubles as the challenge that unlocks its own uploaded scan, which is itself stored AES-256-GCM encrypted on disk.
- Destructive administrative operations require server-side admin authorization.

Two different screens answer to `/admin`, and confusing them is easy:

| Path | What it is |
| --- | --- |
| `localhost:3000/admin` | The placement office's portal. Bound by the RBAC catalog, and where product work belongs. |
| `localhost:8000/admin` | A raw table browser over the SQLAlchemy models, in `backend/app/admin/`. Reads and writes every column of all 15 tables, consulting no role. Off unless `DB_ADMIN_PASSWORD` is set. |

The table browser is a correction tool, not a feature surface. A workflow the
office performs regularly belongs in the portal, behind a permission. See the
2026-09-18 entry in `docs/DECISIONS.md`.

## Authentication and roles

Sign-in is an institute email address and a password. There is no OAuth provider, no Auth.js adapter, and no verification or reset email. See the 2026-09-17 entries in `docs/DECISIONS.md` for what that costs and why it was chosen.

- Signing in requires an address on `STUDENT_EMAIL_DOMAIN` (default `iiitl.ac.in`), matched on the exact domain so lookalike domains are rejected, or an address on the `ADMIN_EMAILS` allowlist.
- `/register` is institute-domain only and never accepts an allowlisted administrator address. It creates a student account, or claims an existing student row that has no password yet, so accounts from the Google era keep their data.
- `/account/password` is where any signed-in user changes their own password, confirming the current one.
- Accounts seeded from `ADMIN_EMAILS` start with no password. `npm run db:set-password -- <email>` sets the first one from the server shell; after that the set-password control on `/admin/users` provisions staff and recovers lost student passwords.
- Failed sign-ins are throttled per address in the frontend process, not in a shared store.
- `ADMIN_EMAILS` serves as the emergency bootstrap allowlist: addresses listed here receive the whole permission catalog automatically and may sign in from outside the institute domain.
- There are four roles: `STUDENT` (Tier 1), `PLACEMENT_VOLUNTEER` (Tier 2), `PLACEMENT_TEAM` (Tier 3), `SUPER_ADMIN` (Tier 4), backed by a 49-entry `module.action` permission catalog. A `_own` suffix (`applications.view_own`) means the holder reaches only rows they own; the route still applies the ownership filter.
- Only `SUPER_ADMIN` holds `rbac.manage`. Assigning a role, editing the custom permission matrix, and creating a user with a non-student role or a permission grant all require it, so `users.manage` alone can provision an account but never escalate one.
- Students hold `_own` permissions by default. Admin-portal access is therefore decided by `hasAnyAdminPermission`, which tests permissions against `STUDENT_SCOPED_PERMISSIONS`; never infer administrative access from a non-empty permission list.
- In addition to role defaults, any user account supports granular per-user custom permission overrides (`customPermissions String[]` on `User`), where a leading `-` revokes.
- Full user lifecycle and RBAC management is available on `/admin/users`, including account provisioning, role elevation & de-elevation, custom permission matrix editing, suspension/activation, and guarded deletion.
- Guardrails protect against self-demotion, self-deactivation, self-deletion, and removal of the last active super-administrator.
- `/admin/*` routes enforce granular permissions via `frontend/src/proxy.ts` and `requirePermission()` server-side guards.
- The frontend calls the backend with a short-lived HS256 JWT signed with the shared `AUTH_SECRET`, embedding effective permissions.

The reusable access rules live in `frontend/src/lib/auth-access.ts` and `frontend/src/lib/permissions.ts` with unit tests.

## Core workflow

1. Profile data supplies CGPA, batch, branch, backlogs, bans, document completeness, and the default resume.
2. Company Events presents the published events and evaluates the profile against their criteria.
3. An eligible student applies with a selected/default resume.
4. Applications tracks `APPLIED → SHORTLISTED → INTERVIEW → SELECTED` plus rejected/withdrawn outcomes.
5. Dashboard aggregates open roles, deadlines, announcements, eligibility, and application counts.

The reusable eligibility rules live in `frontend/src/lib/eligibility.ts` and `backend/app/services/eligibility.py`. Do not implement a third eligibility algorithm in a page component. Both engines take every criterion as a required argument so that adding one forces each call site to supply it rather than silently skipping the check.

## UI system

**Navigation**: both shells — `components/admin/admin-shell.tsx` and
`components/layout/portal-shell.tsx` — render `components/ui/sidebar`, which
owns the drawer, the collapse-to-icon rail and the `Cmd/Ctrl+B` shortcut.
There is no hand-written sidebar CSS left in either stylesheet. The
`--sidebar-*` variables are aliases onto the semantic tokens, not a second
palette; the row sizes and the blue active state are set on the component's
own variants so the two shells cannot drift. See the 2026-09-20 entry in
`docs/DECISIONS.md`.

**Type**: IBM Plex Sans is the only typeface, headings included, with IBM Plex
Mono reserved for identifiers behind the `.identifier` class. Both are
self-hosted through `next/font` in `layout.tsx` as `--font-plex-sans` and
`--font-plex-mono`; `@theme inline` maps Tailwind's `font-sans`/`font-mono`
keys onto them. Headings are 600 — Plex stops at 700, and nothing here needs
it — and negative letter-spacing belongs only above 24px. Read the 2026-09-20
entry in `docs/DECISIONS.md` before renaming either variable; the obvious
name collides with a Tailwind theme key and silently renders the portal in
the browser's default serif.

Every rule reads a semantic token declared in `frontend/src/app/globals.css`;
literal brand hex values only belong in the `:root` token blocks. There is one
brand colour, the institute blue `#1F3A60` — see `docs/DECISIONS.md`
(2026-09-17, "The palette is the institute blue") for why, and the entries
above it for the orange/teal and teal palettes it replaced.

**The ramp**: `--brand-50` … `--brand-950`, all on hue 215°, with
`--brand-800` being `#1F3A60` exactly. It is the only place literal brand hex
values appear.

**Light mode** (the default): white and grey — `--surface` `#FAFAFA`,
`--card-bg` `#FFFFFF`, `--ink` `#18181B`, `--border` `#E4E4E7` — with
`--navy`/`--navy-deep` (`--brand-800`/`900`) for primary fills, active nav, and
a chart's primary series, and `--blue`/`--blue-light` (`--brand-500`/`400`) for
links, focus rings, icon chips, and a chart's secondary series. Status hues are
separate: `--green` success, `--orange` warning/pending/interview (a true amber,
`#D97706`), red error, purple shortlisted. Sidebars are a white panel with a
right border. Gradients are not used in light mode; every fill is solid.

**Dark mode**: black underneath, brand blue on top. `--surface` and the input
wells are `--black-950` (`#000000`) and cards `--black-900`; `--border` is
`--brand-800`, i.e. `#1F3A60` itself, so the brand colour is the chrome you see
against the page. Fills are mid-ramp, not deep: `--navy` is `--brand-600` and
`--blue` is `--brand-400`, because `#1F3A60` as a fill is 1.8:1 against black.
`--on-brand`/`--on-brand-soft`/`--on-brand-muted` are the text on the few
surfaces that stay a solid brand fill in both themes (the login hero,
welcome/profile banners) — not the sidebars, which are dark only in dark mode.

- `--navy`/`--navy-deep`/`--blue`/`--blue-light`/`--brown` keep the same names
  in both themes but resolve to a different rung per theme (deep on white, mid
  on black) — do not assume a token's hue or lightness from its name.
- `rgba()` tints must use the channel tokens (`--brand-rgb`, `--deep-rgb`,
  `--shadow-rgb`, `--warning-rgb`, `--success-rgb`, `--danger-rgb`), because
  `rgba()` cannot read a hex custom property. `--brand-rgb`/`--deep-rgb` anchor
  to the primary accent in both themes.
- Rounded cards, restrained shadows, high information density, and mobile-first responsive layouts
- Student pages use `PortalShell`; admin pages use `AdminShell`.
- Every admin list is the shared `DataTable` (`frontend/src/components/common/data-table.tsx`) configured with columns; its pipeline lives in `frontend/src/lib/data-table.ts`. Do not hand-write another admin table, and give a column its raw `sortValue` rather than letting it sort the formatted cell. `DataTable` is deliberately not on shadcn's `Table`.
- `DataTable` owns the whole block: pass `title` and it renders the section heading with the live row count, `actions` for the list's right-aligned buttons, and one bordered card around the search, the grid, and the pagination. A page supplies only its `<h1>` and its filters. The grid is 15px text on 61px rows under a 50px light header, and it scrolls sideways rather than shrinking — set a column `width` as its px minimum, and `sticky: true` on a leading run of columns to pin them while the rest scrolls.
- Every dialog on either side of the portal is `PortalDialog` (`frontend/src/components/common/portal-dialog.tsx`), which wraps shadcn's Radix dialog and supplies the focus trap and Escape handling. Do not hand-roll a `.modal-backdrop` again. Inside any form, admin or student, reach for the primitives in `frontend/src/components/ui` before writing CSS.
- Use CSS transitions only unless the architecture decision is deliberately changed.

## Repository map

```text
frontend/src/app/                Routes, layouts, route handlers
frontend/src/components/layout/  Student navigation shell
frontend/src/components/admin/   Admin shell and management surfaces
frontend/src/components/common/  Shared UI, including the one admin data table
frontend/src/lib/                Auth, backend client, encryption, eligibility, table pipeline
backend/app/admin/               Database table browser mounted at /admin
backend/app/core/                Config, database session, security, storage
backend/app/routers/             HTTP endpoints
backend/app/schemas/             Pydantic request/response models
backend/app/services/            Business rules
backend/tests/                   pytest suite
database/prisma/                 Schema, migrations, seed
database/scripts/                Administrative maintenance scripts
docs/                            Shared project memory and decisions
```

## Environment

- The root `Makefile` is the operational entry point: `make up` runs the stack, `make seed` fills the database, and `make help` lists every subcommand from the `##` comment on each target. Targets wrap Compose, so Docker is the only prerequisite.
- A `tools` service, behind the `tools` Compose profile so `up` never starts it, shares the `migrate` image and runs every database script (`make db-*`) as a one-shot container on the stack's network.
- `.env` is a Make file target: anything that needs configuration depends on it, and it is written from `.env.example` with generated secrets on first run: `AUTH_SECRET`, `ENCRYPTION_KEY`, and `DB_ADMIN_PASSWORD`. An `.env` written before one of those existed has no line for it, so the feature it guards stays off until a target adds one.
- One `.env` at the repository root serves every service. Compose reads it automatically.
- Compose builds the in-cluster `DATABASE_URL` from `POSTGRES_*`; the `DATABASE_URL` in `.env` points at `localhost` and is only for host-side tooling such as the Prisma CLI. `REDIS_URL` works the same way: Compose points the backend at the `cache` service, and the `.env` value is for host-side runs only.
- `frontend/next.config.ts` loads the root `.env` because Next only looks inside its own directory.
- Frontend on port 3000, backend on port 8000, PostgreSQL on port 5432, Redis on port 6379.
- `/api/health` on both the frontend and the backend is the health endpoint.
- Google callback: `http://localhost:3000/api/auth/callback/google` locally.
- Compose fails fast if `AUTH_SECRET`, `ENCRYPTION_KEY`, or the Google credentials are missing.
- `.env` is private and must never be committed.

## Current implementation boundary

Data access is mid-migration. Profile, resumes, NOC/forms, uploads, feedback submission, and interview experiences call FastAPI through `frontend/src/lib/api-client.ts`. The dashboard, company events, applications, feedback listing, and every other `/admin` surface still call Prisma directly from Next.js server components and actions; porting them to backend endpoints is the outstanding work from the 2026-08-20 decision. Interview experiences was built FastAPI-only from the start, with no Prisma fallback in the frontend.

Google-authenticated students are resolved to their Auth.js/Prisma `User`. The student shell, dashboard, company events, eligibility, applications, core profile fields, and feedback read user-owned records and show explicit empty/incomplete states instead of demonstration data. The admin shell identity, overview metrics, company management, student directory/profile inspection, and event publishing are persistent. Resume file storage, NOC workflows, team/contact management, announcements, and the remaining admin workflows are incomplete and show explicit implementation states rather than fake records. Consult `docs/FEATURE_STATUS.md` before extending a feature.
