# Canonical Project Context

Last updated: 2026-07-17

## Product

The IIIT Lucknow Training & Placement Portal serves two roles:

- Students discover opportunities, maintain profiles and resumes, apply, track outcomes, submit feedback, request NOCs, and access placement resources.
- Administrators manage announcements, companies, job profiles, applications, students, feedback, NOCs, team members, administrators, and placement analytics.

## Current architecture

- Next.js 16 App Router with React 19 and strict TypeScript
- Tailwind CSS 4 plus repository-owned CSS in `src/app/globals.css` and `src/app/admin.css`
- Auth.js v5 beta with Google OAuth and JWT sessions
- Prisma 6 with PostgreSQL 16
- Zod for boundary validation
- Lucide for icons
- Node's test runner with `tsx` for unit tests
- Docker Compose for the local PostgreSQL service and production-style app container

## Authentication and roles

- Real students authenticate with Google accounts ending in `@iiitl.ac.in`.
- `placements@iiitl.ac.in` and accounts explicitly listed in `ADMIN_EMAILS` become admins automatically.
- `/admin/*` requires the `ADMIN` role through `src/proxy.ts`.
- Development credentials exist for local work and are disabled whenever `NODE_ENV=production`.
- Local student: `student@iiitl.ac.in` / `student123`.
- Local admin: `admin@iiitl.ac.in` / `admin123`.
- Do not use development credentials as seed users or production accounts.

## Core workflow

1. Profile data supplies CGPA, batch, branch, backlogs, bans, document completeness, and the default resume.
2. Company Events presents job profiles and evaluates the profile against job criteria.
3. An eligible student applies with a selected/default resume.
4. Applications tracks `APPLIED → SHORTLISTED → INTERVIEW → SELECTED` plus rejected/withdrawn outcomes.
5. Dashboard aggregates open roles, deadlines, announcements, eligibility, and application counts.

The reusable eligibility rules live in `src/lib/eligibility.ts`. Do not implement a second eligibility algorithm in a page component.

## Data model

`prisma/schema.prisma` is authoritative. Main entities are User, Account, Session, Company, JobProfile, Application, Announcement, Feedback, NocRequest, Resume, Coordinator, TeamMember, and Notification.

Important invariants:

- One application per student/job profile.
- Company names, user emails, and student roll numbers are unique where present.
- Job eligibility is evaluated from the student's current profile and job criteria.
- Sensitive Aadhaar/PAN fields contain encrypted payloads, not plaintext.
- Destructive administrative operations require server-side admin authorization.

## UI system

- Primary navy: `#102A43` / deep navy surfaces
- Action orange: `#F97316`
- Blue: `#2563EB`
- Surface: `#F5F7FB`
- Rounded cards, restrained shadows, high information density, and mobile-first responsive layouts
- Student pages use `PortalShell`; admin pages use `AdminShell`.
- Use CSS transitions only unless the architecture decision is deliberately changed.

## Repository map

```text
src/app/                    Routes, layouts, API endpoints
src/components/layout/      Student navigation shell
src/components/admin/       Admin shell and management surfaces
src/components/dashboard/   Student dashboard
src/components/jobs/        Opportunity list/detail interactions
src/components/applications Application tracking
src/components/profile/     Student profile and resumes
src/components/feedback/    Feedback workflows
src/components/forms/       Guidelines, forms, and NOCs
src/lib/                    Auth, Prisma, encryption, eligibility, shared data
prisma/                     Schema, migrations, and seed
docs/                       Shared project memory and decisions
```

## Environment

- Local PostgreSQL is exposed on port 5432 by Docker Compose.
- The Next.js development server runs on port 3000.
- `/api/health` is the service health endpoint.
- Google callback: `http://localhost:3000/api/auth/callback/google` locally.
- `.env` is private and must never be committed.

## Current implementation boundary

Google-authenticated students are resolved to their Auth.js/Prisma `User`. The student shell, dashboard, company events, eligibility, applications, core profile fields, and feedback read user-owned database records and show explicit empty/incomplete states instead of demonstration student data. The admin shell identity, overview metrics, company management, student directory/profile inspection, and job-profile publishing are Prisma-backed; legacy seeded recruiter/job data has been removed. Profile identity document entry, resume file storage, NOC workflows, team/contact management, announcements, and the remaining admin workflows are incomplete and show explicit implementation states rather than fake records. Consult `docs/FEATURE_STATUS.md` before extending a feature.
