# TNP Student Portal — Implementation Plan

## Overview

Build a **Training & Placement (TnP) Portal** for IIIT Lucknow's placement team to manage internship/placement opportunities, student profiles, applications, and company events. This will be a **student-facing + admin-facing** portal, significantly upgrading the reference system with modern design, robust security, and Docker-based deployment.

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| **User Roles** | 2 roles — Student + Admin (admin can add other admins) |
| **Authentication** | Google OAuth (`@iiitl.ac.in` for students, `placements@iiitl.ac.in` for admin) |
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn/UI |
| **Backend** | Next.js API Routes + Server Actions, Prisma ORM |
| **Database** | PostgreSQL (Neon or Supabase managed) |
| **File Storage** | Cloudinary or AWS S3 (resumes, documents) |
| **Animations** | CSS transitions only (no Framer Motion) |
| **Deployment** | Dockerized, with docker-compose |
| **Branding** | IIIT Lucknow theme — Blue primary + Orange accent |
| **Data** | Fresh start (no data migration) |
| **Notifications** | Email + In-app (Phase 2 module) |
| **Team Size** | 5 people |

---

## 1. Tech Stack

### Frontend

| Technology | Purpose |
|-----------|---------|
| **Next.js 14+ (App Router)** | Full-stack React framework with SSR, API routes, middleware |
| **TypeScript** | Type safety across the entire codebase |
| **Tailwind CSS** | Utility-first CSS framework for rapid, consistent styling |
| **Shadcn/UI + Radix UI** | Accessible, customizable component library |
| **React Hook Form + Zod** | Type-safe form validation |
| **TanStack Table** | Powerful data tables with sorting, filtering, pagination |
| **Sonner** | Toast notifications |
| **Lucide React** | Icon library |

### Backend

| Technology | Purpose |
|-----------|---------|
| **Next.js Server Actions + API Routes** | Backend logic co-located with frontend |
| **NextAuth.js v5 (Auth.js)** | Google OAuth, session management, role-based access |
| **Prisma ORM** | Type-safe DB access, migrations, seeding |
| **PostgreSQL** | Primary database |
| **Resend** | Transactional email (application updates, announcements) |
| **Uploadthing** or **AWS S3** | File uploads (resumes, NOC documents) |

### DevOps & Infrastructure

| Technology | Purpose |
|-----------|---------|
| **Docker + docker-compose** | Containerized deployment (Next.js app + PostgreSQL) |
| **GitHub Actions** | CI/CD — lint, type-check, test, build, deploy |
| **Neon** or **Self-hosted PostgreSQL** | Database (Neon for cloud, self-hosted in Docker for on-prem) |
| **Nginx** (optional) | Reverse proxy + SSL termination in production |

---

## 2. Branding & Design System

Inspired by [iiitl.ac.in](https://iiitl.ac.in) and [placements.iiitl.ac.in](https://placements.iiitl.ac.in).

### Color Palette

| Token | Color | Hex | Usage |
|-------|-------|-----|-------|
| `primary` | Deep Navy Blue | `#1E3A5F` | Sidebar, headers, primary buttons |
| `primary-light` | Royal Blue | `#2563EB` | Links, active states, highlights |
| `primary-dark` | Dark Navy | `#0F1D32` | Dark backgrounds |
| `accent` | Vibrant Orange | `#F97316` | CTAs, badges, action buttons |
| `accent-warm` | Amber | `#F59E0B` | Warnings, highlights |
| `success` | Emerald | `#10B981` | Success states, eligibility pass |
| `danger` | Rose | `#EF4444` | Errors, eligibility fail, destructive actions |
| `surface` | Slate 50 | `#F8FAFC` | Page backgrounds |
| `surface-card` | White | `#FFFFFF` | Card backgrounds |
| `text-primary` | Slate 900 | `#0F172A` | Primary text |
| `text-secondary` | Slate 500 | `#64748B` | Secondary text, labels |
| `border` | Slate 200 | `#E2E8F0` | Borders, dividers |

### Typography

- **Primary Font**: `Inter` (Google Fonts) — clean, modern, great for data-heavy UIs
- **Heading Font**: `Plus Jakarta Sans` — premium feel for headings
- **Monospace**: `JetBrains Mono` — code/data displays

### Design Features

- Clean white content area with subtle blue sidebar
- Orange accent for all primary CTAs and important badges
- Soft shadows and rounded corners (8px–12px)
- Skeleton loaders for data-heavy pages
- Hover transitions on cards and table rows (CSS `transition: all 0.2s`)
- Responsive: mobile-first with collapsible sidebar

---

## 3. Database Schema

### Entity Relationship Diagram

```
USER ──┬── APPLICATION ──── JOB_PROFILE ──── COMPANY
       ├── FEEDBACK
       ├── RESUME
       ├── NOC_REQUEST
       └── NOTIFICATION
```

### Tables

#### USER
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | String | |
| email | String | Unique, `@iiitl.ac.in` |
| personalEmail | String | |
| rollNumber | String | Unique |
| branch | String | IT, CS, CSB, CSAI |
| batch | Int | Graduation year |
| degree | String | BTech, MTech, MBA, MSc, PhD |
| category | String | GENERAL, OBC, SC, ST, EWS |
| gender | String | |
| dateOfBirth | Date | |
| bloodGroup | String | |
| contactNumber | String | |
| altContactNumber | String | |
| currentAddress | Text | |
| permanentAddress | Text | |
| aadhaar_encrypted | String | AES-256-GCM encrypted |
| panCard_encrypted | String | AES-256-GCM encrypted |
| class10Percent | Float | |
| class12Percent | Float | |
| semGPAs | Float[] | Array of semester GPAs |
| cgpa | Float | |
| cgpaBeforeDrop | Float | |
| graduationGPA | Float | |
| backlogs | Int | |
| bans | Int | |
| profilePhotoUrl | String | |
| qrCodeData | String | |
| role | Enum | STUDENT, ADMIN |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### COMPANY
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | String | Unique |
| logoUrl | String | |
| website | String | |
| description | Text | |
| createdAt | DateTime | |

#### JOB_PROFILE
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| companyId | UUID | FK → COMPANY |
| title | String | |
| type | Enum | INTERNSHIP, FTE, INTERNSHIP_PPO, INTERNSHIP_FTE |
| locations | String[] | |
| ctcStipend | Float | |
| ctcStipendInfo | String | |
| minCGPA | Float | |
| maxBacklogs | Int | |
| maxBans | Int | |
| allowedBranches | String[] | |
| allowedDegrees | String[] | |
| allowedGenders | String[] | |
| jobCategory | String | TECH, NON-TECH, etc. |
| batch | Int | |
| registrationDeadline | DateTime | |
| status | Enum | ACTIVE, ENDED, DRAFT |
| description | Text | |
| openingOverview | Text | |
| attachments | String[] | |
| createdAt | DateTime | |
| createdBy | UUID | FK → USER (admin) |

#### APPLICATION
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → USER |
| jobProfileId | UUID | FK → JOB_PROFILE |
| status | Enum | APPLIED, SHORTLISTED, INTERVIEW, SELECTED, REJECTED, WITHDRAWN |
| appliedAt | DateTime | |
| updatedAt | DateTime | |

#### ANNOUNCEMENT
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| title | String | |
| companyId | UUID | FK → COMPANY (optional) |
| content | Text | |
| tags | String[] | FTE, Internship, PPO, Shortlist, Update, etc. |
| category | Enum | COMPANY_EVENT, GENERAL |
| createdAt | DateTime | |
| createdBy | UUID | FK → USER (admin) |

#### FEEDBACK
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → USER |
| name | String | Auto-populated |
| rollNumber | String | Auto-populated |
| email | String | Auto-populated |
| feedbackType | Enum | QUERY, FEEDBACK, COMPLAINT |
| content | Text | |
| resolved | Boolean | Default: false |
| adminResponse | Text | |
| createdAt | DateTime | |
| resolvedAt | DateTime | |

#### NOC_REQUEST
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → USER |
| company | String | |
| address | String | |
| city | String | |
| state | String | |
| pincode | String | |
| startDate | Date | |
| endDate | Date | |
| status | Enum | PENDING, APPROVED, REJECTED |
| message | Text | |
| documentUrl | String | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### RESUME
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → USER |
| label | String | Resume 1, Resume 2, etc. |
| fileUrl | String | |
| fileName | String | |
| uploadedAt | DateTime | |

#### COORDINATOR
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| jobProfileId | UUID | FK → JOB_PROFILE |
| name | String | |
| phone | String | |

#### TEAM_MEMBER
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | String | |
| role | String | TPO, Coordinator, Executive, etc. |
| email | String | |
| phone | String | |
| photoUrl | String | |
| displayOrder | Int | |

#### NOTIFICATION
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → USER |
| title | String | |
| message | Text | |
| link | String | Deep link to relevant page |
| read | Boolean | Default: false |
| createdAt | DateTime | |

---

## 4. Feature Modules

### Student-Facing Pages

| # | Module | Route(s) | Key Features |
|---|--------|----------|-------------|
| 1 | **Auth** | `/login`, `/register` | Google OAuth with `@iiitl.ac.in` domain restriction, role-based redirect |
| 2 | **Dashboard** | `/dashboard` | Announcement feed, search, tag filters (FTE, Internship, PPO, Shortlist, etc.), category tabs (All, Company Event, General) |
| 3 | **Company Events** | `/company-events`, `/company-events/[id]` | Searchable job profiles table, filter by type/status, detailed profile page with eligibility auto-check |
| 4 | **Applications** | `/applications` | My applications tracker, status badges (Applied → Shortlisted → Interview → Selected/Rejected), one-click apply |
| 5 | **Profile** | `/profile` | Personal info, academics (sem GPAs, CGPA), documents (Aadhaar/PAN encrypted), resume upload (multiple), QR hall card |
| 6 | **Feedback** | `/feedback`, `/feedback/new` | Submit feedback/query form (auto-populated student info), my feedbacks list with resolved toggle |
| 7 | **Forms & Docs** | `/forms` | TnP Guidelines tab, NOC request & management tab, downloadable forms tab |
| 8 | **Contact & Team** | `/contact`, `/team` | TnP team directory, contact info cards |

### Admin-Facing Pages

| # | Route | Key Features |
|---|-------|-------------|
| 9.1 | `/admin/dashboard` | Analytics: placements by company, branch-wise stats, offer vs acceptance rates |
| 9.2 | `/admin/announcements` | Create/edit/delete announcements with tags |
| 9.3 | `/admin/companies` | Manage company profiles with logos |
| 9.4 | `/admin/job-profiles` | Create job profiles, set eligibility criteria, assign coordinators |
| 9.5 | `/admin/applications` | View all applications, bulk shortlist, filter, export to CSV/Excel |
| 9.6 | `/admin/students` | View/search all student profiles, ban/unban, export data |
| 9.7 | `/admin/feedbacks` | Respond to student feedbacks, mark resolved |
| 9.8 | `/admin/noc-requests` | Approve/reject NOC requests, upload signed documents |
| 9.9 | `/admin/team` | Manage TnP team member cards displayed on the website |
| 9.10 | `/admin/settings` | Manage other admins, system configuration |

---

## 5. Project Structure

```
tnp-portal/
├── docker-compose.yml
├── Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
│   └── images/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (student)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── company-events/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── applications/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── feedback/
│   │   │   │   ├── page.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── forms/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   └── team/page.tsx
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── dashboard/page.tsx
│   │   │       ├── announcements/page.tsx
│   │   │       ├── companies/page.tsx
│   │   │       ├── job-profiles/
│   │   │       │   ├── page.tsx
│   │   │       │   └── new/page.tsx
│   │   │       ├── applications/page.tsx
│   │   │       ├── students/page.tsx
│   │   │       ├── feedbacks/page.tsx
│   │   │       ├── noc-requests/page.tsx
│   │   │       ├── team/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   └── upload/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/              (shadcn components)
│   │   ├── layout/          (sidebar, header, footer)
│   │   ├── dashboard/       (announcement cards, filters)
│   │   ├── profile/         (profile sections, resume upload)
│   │   ├── admin/           (admin-specific components)
│   │   └── shared/          (data tables, modals, badges)
│   ├── lib/
│   │   ├── auth.ts          (NextAuth config)
│   │   ├── db.ts            (Prisma client)
│   │   ├── utils.ts         (helpers)
│   │   ├── validators.ts    (Zod schemas)
│   │   └── constants.ts     (branches, degrees, tags)
│   ├── actions/             (Server Actions)
│   │   ├── auth.ts
│   │   ├── announcements.ts
│   │   ├── applications.ts
│   │   ├── companies.ts
│   │   ├── feedback.ts
│   │   ├── job-profiles.ts
│   │   ├── noc.ts
│   │   ├── profile.ts
│   │   └── admin.ts
│   ├── hooks/               (custom React hooks)
│   └── types/               (TypeScript types)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

---

## 6. Docker Architecture

```
┌──────────────────────────────────────────┐
│              Docker Compose              │
│                                          │
│  ┌──────────────┐   ┌────────────────┐   │
│  │  Next.js App │──▶│  PostgreSQL 16 │   │
│  │  Port 3000   │   │  Port 5432     │   │
│  └──────┬───────┘   └────────────────┘   │
│         │                                │
└─────────┼────────────────────────────────┘
          │
          ├──▶ Google OAuth (external)
          ├──▶ File Storage — S3/Cloudinary (external)
          └──▶ Resend — Email (external)
```

### Containers

- **app**: Next.js on Node 20 Alpine
- **db**: PostgreSQL 16 with persistent volume
- Environment variables via `.env` file
- Health checks on both containers
- Production: add **Nginx** container for SSL termination

---

## 7. Security Architecture

| Layer | Implementation |
|-------|---------------|
| **Authentication** | Google OAuth via NextAuth.js, restricted to `@iiitl.ac.in` domain |
| **Authorization** | Middleware-based role check on every route (`STUDENT` vs `ADMIN`) |
| **Session** | JWT tokens stored in httpOnly, secure, sameSite cookies |
| **Data Encryption** | Aadhaar & PAN encrypted at rest using AES-256-GCM |
| **Input Validation** | Zod schemas on all Server Actions (server-side validation) |
| **CSRF** | Built-in Next.js CSRF protection + SameSite cookies |
| **Rate Limiting** | Rate limiting on auth & upload endpoints via middleware |
| **File Upload** | Type validation (PDF only for resumes), size limits (5MB), virus scanning hook |
| **SQL Injection** | Prevented via Prisma parameterized queries |
| **XSS** | React's built-in escaping + Content Security Policy headers |
| **Headers** | `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` |
| **RBAC** | Route groups: `(student)` and `(admin)` with middleware guards |

---

## 8. Team Work Split (5 People)

Each person owns specific modules **end-to-end** (frontend + backend + tests). This prevents merge conflicts and ensures clear ownership.

| Person | Role | Modules | Responsibilities |
|--------|------|---------|-----------------|
| **Person 1** | **Tech Lead / Architect** | Auth + Infrastructure | Project setup (Next.js, Prisma, Docker, CI/CD), database schema & migrations, Google OAuth integration, middleware (RBAC, rate limiting), security headers, deployment pipeline, code reviews |
| **Person 2** | **Frontend Lead** | Dashboard + Company Events | Announcement feed with search/filters, company events data table, job profile detail page with eligibility checker, sidebar/header layout, design system setup (Tailwind config, Shadcn theme), responsive design |
| **Person 3** | **Full-Stack Dev** | Profile + Applications | Student profile page (all sections), resume upload, QR hall card, academic records, encrypted PII storage, applications page, one-click apply flow, application status tracking |
| **Person 4** | **Full-Stack Dev** | Feedback + Forms + Contact/Team | Feedback submission form, my feedbacks list, NOC request workflow, forms/docs page with tabs, contact us page, team directory, email notification integration |
| **Person 5** | **Full-Stack Dev** | Admin Panel | All admin pages: analytics dashboard, CRUD for announcements/companies/job profiles, applications management (bulk shortlist, export), student management, feedbacks management, NOC approvals, team management, admin settings |

### Shared Work

| Task | Owner |
|------|-------|
| PR Reviews | Everyone reviews at least 2 PRs/week |
| Testing | Each person writes tests for their modules |
| Documentation | Each person documents their APIs |
| Design QA | Person 2 reviews all UI PRs for design consistency |
| Security Review | Person 1 reviews all PRs for security concerns |

### Git Workflow

- `main` — production (protected, requires 2 approvals)
- `develop` — integration branch
- `feature/module-name` — individual feature branches
- PR template with checklist (types, tests, screenshots)
- Squash-merge only

---

## 9. Timeline (10 Weeks)

### Phase 0: Setup — Week 1

| Task | Owner |
|------|-------|
| Next.js project init, Tailwind + Shadcn setup, Prisma schema, Docker config, GitHub repo with CI/CD, env vars | Person 1 |
| Design system (colors, typography, component theme), layout shell (sidebar, header) | Person 2 |

### Phase 1: Auth + Core — Weeks 2–3

| Task | Owner |
|------|-------|
| Google OAuth, login/register pages, RBAC middleware, session management | Person 1 |
| Dashboard (announcements feed, search, filters, tags) | Person 2 |
| Profile page (personal info, academics, contact) | Person 3 |
| Feedback form + list page | Person 4 |
| Admin layout shell + admin dashboard skeleton | Person 5 |

### Phase 2: Features — Weeks 4–6

| Task | Owner |
|------|-------|
| Security hardening, encryption service, file upload infrastructure | Person 1 |
| Company events table + detail page + eligibility checker | Person 2 |
| Resume upload, QR hall card, applications page, apply flow | Person 3 |
| NOC workflow, forms/docs page, contact/team pages | Person 4 |
| Admin CRUD: announcements, companies, job profiles | Person 5 |

### Phase 3: Admin + Polish — Weeks 7–8

| Task | Owner |
|------|-------|
| Docker production config, Nginx, deployment automation | Person 1 |
| Responsive design pass, skeleton loaders, empty states | Person 2 |
| Eligibility engine (auto-check all criteria), PII encryption | Person 3 |
| Email notifications (new announcement, application update) | Person 4 |
| Admin: applications management, student management, exports | Person 5 |

### Phase 4: Testing + QA — Week 9

| Task | Owner |
|------|-------|
| Security audit, penetration testing, performance optimization | Person 1 |
| Cross-browser testing, design polish, accessibility audit | Person 2 |
| Integration testing, edge case handling | Person 3 |
| End-to-end test flows, documentation | Person 4 |
| Admin panel testing, data export validation | Person 5 |

### Phase 5: Launch — Week 10

| Task | Owner |
|------|-------|
| Staging deployment, UAT with real students, bug fixes, production launch | **All** |

---

## 10. Environment Variables

```env
# .env.example

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tnp_portal"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secure-secret"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# File Storage (choose one)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
# OR
AWS_S3_BUCKET=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION=""

# Email
RESEND_API_KEY=""

# Encryption
ENCRYPTION_KEY="32-byte-hex-key-for-aes-256-gcm"
```

---

## 11. Verification Plan

### Automated Tests

```bash
npm run lint          # ESLint + Prettier
npm run type-check    # TypeScript compiler
npm run test          # Vitest unit + integration tests
npm run test:e2e      # Playwright E2E tests
```

### Manual Verification

- [ ] Google OAuth login flow with `@iiitl.ac.in` accounts
- [ ] RBAC: student cannot access `/admin/*`, admin can access everything
- [ ] Profile update with all fields including encrypted PII
- [ ] Job application flow with eligibility auto-check
- [ ] File upload (resume PDF, NOC documents)
- [ ] Admin CRUD operations on all entities
- [ ] Responsive design on mobile/tablet/desktop
- [ ] Docker build + deployment test

---

## 12. References

- [IIIT Lucknow Official Website](https://iiitl.ac.in)
- [IIIT Lucknow Placements Site](https://placements.iiitl.ac.in)
- Reference screenshots in `./reference images/` folder
