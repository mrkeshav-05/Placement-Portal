<div align="center">

# IIIT Lucknow Placement Portal

### One portal for opportunities, applications, student profiles, and placement operations

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

A responsive student and administration platform for the Training & Placement Cell at IIIT Lucknow.

</div>

---

## What it does

The portal gives students a single place to discover opportunities, verify eligibility, manage their placement profile and resumes, apply to roles, track application progress, submit feedback, and request NOCs.

Placement administrators receive a separate role-protected workspace for companies, job profiles, applications, students, announcements, feedback, NOCs, team members, administrators, and placement analytics.

```mermaid
flowchart LR
    P[Student Profile] --> E[Eligibility Engine]
    J[Job Profiles] --> E
    E --> A[Apply with Resume]
    A --> T[Application Tracker]
    T --> D[Student Dashboard]
    AD[Admin Operations] --> J
    AD --> T
    AD --> D
```

## Highlights

### Student portal

- Searchable announcement dashboard with deadlines and placement metrics
- Company opportunity directory with type and status filters
- Automatic CGPA, batch, branch, backlog, ban, and document eligibility checks
- Application timeline from applied through selection
- Editable personal, academic, contact, identity-document, and resume sections
- Feedback/query tracking, placement guidelines, NOC requests, forms, contacts, and team directory

### Administration portal

- Placement analytics and branch-level reporting UI
- Management surfaces for announcements, companies, job profiles, and applications
- Student, feedback, NOC, placement-team, and administrator management
- Server-side role protection for all `/admin/*` routes

### Engineering foundation

- Google OAuth through Auth.js with `@iiitl.ac.in` domain enforcement
- PostgreSQL schema and migrations managed through Prisma
- AES-256-GCM helpers for sensitive identity fields
- Shared eligibility engine with unit tests
- Dockerized application and PostgreSQL services
- GitHub Actions verification pipeline
- Cross-agent project context for consistent team contributions

## Technology

| Layer | Stack |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, responsive repository-owned design system |
| Authentication | Auth.js, Google OAuth, JWT sessions, role-based access |
| Database | PostgreSQL 16, Prisma 6 |
| Validation and security | Zod, AES-256-GCM, security headers |
| Testing | Node test runner with `tsx` |
| Infrastructure | Docker, Docker Compose, GitHub Actions |

## Quick start

### Requirements

- Node.js 20 or newer
- npm
- Docker Desktop with the Linux engine running

### 1. Install dependencies

```bash
git clone https://github.com/mrkeshav-05/Placement-Portal.git
cd Placement-Portal
npm install
```

### 2. Configure the environment

Copy `.env.example` to `.env` and generate private values for `AUTH_SECRET` and `ENCRYPTION_KEY`.

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The local database URL is:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tnp_portal"
```

Never commit `.env` or real student data.

### 3. Start and initialize PostgreSQL

```bash
docker compose up -d db
npx prisma migrate dev
npm run db:seed
```

### 4. Start the portal

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Development accounts

The following accounts work only outside production and do not require Google OAuth or PostgreSQL sessions:

| Role | Email | Password |
|---|---|---|
| Student | `student@iiitl.ac.in` | `student123` |
| Administrator | `admin@iiitl.ac.in` | `admin123` |

Development credential login is automatically rejected when `NODE_ENV=production`.

## Google OAuth

Create a Google OAuth web client and register this local callback:

```text
http://localhost:3000/api/auth/callback/google
```

Then set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env`. Add the equivalent HTTPS callback before production deployment.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run strict TypeScript checks |
| `npm test` | Run eligibility and encryption tests |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:seed` | Seed initial admin, company, and job data |

Run the full verification suite before opening a pull request:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

## Repository structure

```text
src/app/                    App Router pages and API routes
src/components/layout/      Student portal shell
src/components/admin/       Admin shell, analytics, and management UI
src/components/dashboard/   Announcements and student metrics
src/components/jobs/        Opportunity browsing and apply interaction
src/components/profile/     Student profile and resume management
src/components/applications Application tracking
src/lib/                    Auth, database, encryption, and eligibility logic
prisma/                     Schema, migrations, and seed data
docs/                       Architecture, feature status, decisions, and handoffs
```

## Current status

The database schema, authentication boundary, route protection, migration, seed data, encryption and eligibility utilities, Docker setup, CI, and complete responsive UI are implemented.

Some visible create/update actions still use local demonstration state while their Prisma-backed server actions are developed. The exact boundary for every module is maintained in [Feature Status](./docs/FEATURE_STATUS.md).

## Contributing with humans or coding agents

All contributors and coding agents start with:

1. [Agent Operating Guide](./AGENTS.md)
2. [Canonical Project Context](./docs/PROJECT_CONTEXT.md)
3. [Feature Status](./docs/FEATURE_STATUS.md)
4. [Current Handoff](./docs/HANDOFF.md)

Architectural decisions are recorded in [Decisions](./docs/DECISIONS.md), and the contribution workflow is documented in [CONTRIBUTING.md](./CONTRIBUTING.md). Claude, Cursor, and GitHub Copilot also receive tool-specific entry files that point back to the same canonical context.

## Security notes

- Keep OAuth, database, email, storage, and encryption credentials outside source control.
- Authorize every sensitive operation on the server.
- Encrypt Aadhaar/PAN values before persistence and never include them in logs.
- Validate uploaded resumes by ownership, MIME type, signature, and size.
- Replace all local/demo secrets before deployment.

---

<div align="center">
Built for the Training & Placement community at IIIT Lucknow.
</div>
