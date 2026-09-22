# Architectural Decisions

This is a lightweight decision log. Append a dated entry when changing a decision; do not rewrite history.

## 2026-07-12 — Full-stack Next.js

Use the Next.js App Router for UI, server actions, and route handlers so authorization and validation remain close to each workflow.

## 2026-07-12 — PostgreSQL and Prisma

Use PostgreSQL as the sole application database and Prisma as the sole ORM. Local development uses PostgreSQL 16 through Docker Compose.

## 2026-07-12 — Auth.js with JWT sessions

Use Google OAuth for institute accounts and JWT sessions for compatibility with database-free development credentials. Server-side route guards enforce roles.

## 2026-07-12 — Development credentials

Expose documented student/admin credentials only outside production so contributors can work before Google credentials are available.

## 2026-07-12 — Encrypted identity fields

Encrypt Aadhaar and PAN using AES-256-GCM with a 32-byte environment key. Store IV, authentication tag, and ciphertext together; never store plaintext.

## 2026-07-13 — Repository as shared agent memory

Treat `AGENTS.md` and `docs/PROJECT_CONTEXT.md` as the canonical onboarding context for humans and AI agents. Tool-specific instruction files must point back to these canonical files rather than duplicating project facts.

## 2026-07-17 — External administrator allowlist

Keep student Google access restricted to `@iiitl.ac.in`, while permitting explicitly trusted external Google accounts to receive `ADMIN` through the comma-separated `ADMIN_EMAILS` environment variable. Authorization remains enforced in the Auth.js callback and JWT role assignment.

## 2026-08-20 — FastAPI owns data access; Prisma owns the schema

Supersedes the data-access half of *2026-07-12 — Full-stack Next.js*. A FastAPI service had already been added under `backend/` without a decision entry, leaving two ORMs against one database: Prisma called directly from Next.js server actions, and SQLAlchemy behind FastAPI. That split is now resolved deliberately.

- `backend/` (FastAPI + SQLAlchemy) is the single owner of application data access. All remaining direct Prisma calls in the frontend are to be ported to backend endpoints.
- `database/` (Prisma) remains the single owner of the schema, migrations, and seed data. The SQLAlchemy models in `backend/app/models/db.py` mirror `schema.prisma` and must never run `create_all()` or otherwise migrate.
- `frontend/` is a Next.js UI client. It keeps Prisma only for the Auth.js adapter and the not-yet-ported pages listed in `docs/FEATURE_STATUS.md`.
- The frontend authenticates to the backend with a short-lived HS256 JWT signed with the shared `AUTH_SECRET`.

The Next.js App Router, server actions, and server-side authorization decisions from 2026-07-12 still stand; only the location of data access changed.

## 2026-08-20 — Service-per-container repository layout

Split the repository into `frontend/`, `backend/`, and `database/`, each with its own Dockerfile, plus `docker-compose.yml` for a production-style stack and `docker-compose.dev.yml` for hot reload. `frontend` and `database` are npm workspaces sharing one root lockfile, because a single Prisma schema cannot resolve a client across two independent `node_modules` trees. Compose builds the in-cluster `DATABASE_URL` from the `POSTGRES_*` values rather than passing the root `.env` value through, which points at `localhost` for host-side tooling.

Schema migrations run in a dedicated one-shot `migrate` container that must exit successfully before the backend starts, so no service ever boots against an out-of-date schema.

## 2026-08-20 — Google-only sign-in; `ADMIN_EMAILS` is the only admin source

Supersedes *2026-07-12 — Development credentials*.

- The Auth.js credentials provider is removed. Google is the only sign-in method in every environment. The previous development accounts returned synthetic user ids that did not exist in the database, which broke Prisma-backed admin pages.
- `placements@iiitl.ac.in` is no longer hardcoded as an administrator. `ADMIN_EMAILS` is the only source of the `ADMIN` role; when it is empty, nobody is an administrator.
- The student domain is configurable through `STUDENT_EMAIL_DOMAIN` and matched on the exact domain rather than a suffix, so lookalike domains cannot pass.
- Roles are recomputed from `ADMIN_EMAILS` on every request and reconciled in the database on every sign-in, so removing an address revokes access immediately instead of when the session expires. `require_admin` in the backend re-checks the allowlist rather than trusting the signed role claim alone.

## 2026-08-21 — Link Google accounts to existing users by email

Refines *2026-08-20 — Google-only sign-in*. The seed creates a `User` row for every address in `ADMIN_EMAILS` before that person has ever signed in. Auth.js refuses by default to attach an OAuth account to an existing user row with the same email, so every administrator's first Google sign-in failed with `OAuthAccountNotLinked`.

`allowDangerousEmailAccountLinking` is therefore enabled on the Google provider. The flag is only dangerous when a second, non-verifying provider can assert an address that already belongs to somebody else. Google is the only provider, the credentials provider is gone, and the `signIn` callback rejects a profile whose `email_verified` claim is `false`, so an address cannot be claimed without Google having verified ownership.

Do not add a second provider without revisiting this. Any provider that does not verify email ownership would, combined with this flag, allow account takeover by email collision.

## 2026-08-21 — Palette derived from the institute logo

Supersedes the navy/orange palette recorded under *UI system* in `docs/PROJECT_CONTEXT.md`. The previous colours (`#102A43`, `#2563EB`, `#F97316`) were generic Tailwind-family values chosen before the institute logo was available, and they did not match the mark shown in the header.

The palette is now sampled directly from `frontend/public/iiitl-logo.png`: blue `#005F99`, deep blue `#00446D`, circuit green `#008325`, arch orange `#DE6C1A`, brown `#782D0D`. These are declared as CSS custom properties in `globals.css` and the previously hardcoded brand hex values throughout `globals.css` and `admin.css` were migrated onto the same family.

Two consequences worth keeping:

- Success states moved from the teal-leaning emerald family to the logo's green, so positive feedback reads as part of the brand rather than as a generic Tailwind accent.
- Brand marks render the logo on a white tile. The logo's blue and green have too little contrast against the dark sidebar to sit directly on it, and recolouring the logo is not an option.

Add new colour work as tokens. Literal brand hex values in component styles are what made this migration a 108-replacement change rather than a one-line one.

## 2026-08-25 — Semantic light/dark theme system & left-aligned application funnel

- **Theme Architecture**: Added dark mode support across student and admin surfaces via semantic CSS custom properties in `globals.css` and `admin.css`. A React `ThemeProvider` (`theme-provider.tsx`) synchronized with `localStorage` and the OS `prefers-color-scheme` media query via `useSyncExternalStore` manages `'light' | 'dark' | 'system'` modes with zero hydration flash.
- **Application Funnel**: Redesigned the admin dashboard application funnel from a centered staggered layout to a left-aligned horizontal stage breakdown with proportional volume bars, stage indicators, and guarded conversion percentage calculations.

## 2026-08-25 — Hierarchical RBAC & Granular User Management

- Extended the database role hierarchy from binary `[STUDENT, ADMIN]` to `[STUDENT, COORDINATOR, OFFICER, ADMIN, SUPER_ADMIN]`.
- Implemented a 16-permission RBAC catalog across all portal domains with category groupings, role defaults, and custom per-user permission overrides (`customPermissions String[]` on `User`).
- Added full user management capabilities on `/admin/users` (user provisioning, role elevation & de-elevation, custom permission matrix configuration, account activation/suspension, and safe user deletion).
- Built security guardrails against self-demotion, self-deactivation, self-deletion, and removal of the last active super-administrator, while preserving `ADMIN_EMAILS` as the emergency bootstrap superadmin source.

## 2026-08-25 — Persistent Announcement Lifecycle Management

- Implemented persistent announcement management (`add`, `edit`, `delete`, `preview`, `filter`, and `tag`) across FastAPI (`/api/v1/announcements`) and Next.js admin & student surfaces.
- Secured administrative operations with `announcements:manage` permission checks (`SUPER_ADMIN`, `ADMIN`, `OFFICER`, `COORDINATOR` by default).
- Added multi-category classification (`COMPANY_EVENT` vs `GENERAL`), associated company tagging, and preset/custom pill tags (Shortlists, Interviews, Drive, PPT, Policies, Urgent).
- Enhanced student dashboard feed with search by title/content/tags/company, category filtering, tag indicators, and a detail inspection modal for multi-line instructions and test links.

## 2026-08-25 — NOC Requests & Support Feedback Lifecycle Workflows

- **NOC Requests Architecture**: Implemented full student lifecycle (`POST /api/v1/noc`, `PATCH /api/v1/noc/{id}/cancel`, inspection modal, signed certificate in-portal preview and download) and administrative management (`GET /api/v1/noc/admin`, `/approve`, `/reject`, `/document`, `/metrics`) guarded by `noc:manage` permission.
- **Signed Certificate Handling**: Signed NOC certificates are uploaded through authenticated multipart endpoints to disk storage (`noc_docs/`) and served with authorization checks allowing student owners and placement administrators to view and download their documents.
- **Feedback & Queries Lifecycle**: Implemented student submission (`POST /api/v1/feedback`) with multi-type categorization (`QUERY`, `FEEDBACK`, `COMPLAINT`) and structured JSON storage; student history with type/resolution filters; and administrative workspace (`GET /api/v1/feedback/admin`, `POST /api/v1/feedback/admin/{id}/respond`, `DELETE`) guarded by `feedbacks:manage` permission.
- **Student Notifications**: Admin NOC approval/rejection and feedback responses trigger automated in-app `Notification` records and background email dispatch.

## 2026-08-25 — Placement Team Lifecycle & Default Permissions Architecture

- **Dynamic Public Directory**: Replaced hardcoded presentation on `/team` and `/contact` with dynamic database loading of `TeamMember` records ordered by `displayOrder`, with photo and tonal initials avatar fallbacks.
- **Administrative Team Workspace**: Implemented full management on `/admin/team` (create, update, delete, reorder) guarded by `team:manage` permission, with linked `User` account indicators and direct links to User Management.
- **Default Permissions Management**: Added `SystemSetting` table (`key`, `value`, `updatedAt`) in Prisma and SQLAlchemy to persist the admin-configurable default permissions set for the single placement team (`placement_team_default_permissions`).
- **Automated Permission Synchronization**: Adding a team member with an email automatically assigns the placement team's default permissions to their `User.customPermissions` (and on new user creation in `auth.ts`). Removing a member automatically revokes the default permissions while preserving any prior custom permissions. Admins retain full control to further adjust individual permissions manually in User Management.

## 2026-09-15 — Interview Experiences (moderated community submissions)

Replaces the manual Google Form previously used to collect company-wise interview questions from students.

- Added an `InterviewExperience` model (Prisma-owned schema, SQLAlchemy mirror) capturing company, role, batch, interview type, and one optional free-text field per question category from the old form (DSA, OOPS, DBMS, OS, CN, SQL, system design, CS fundamentals, resume, projects, coding, aptitude, HR, behavioral, resources, unanswered questions, tips).
- **Moderation, not open publishing**: submissions start `PENDING` and are only visible to other students once an admin/coordinator with the new `interview_experiences:manage` permission (`SUPER_ADMIN`, `ADMIN`, `OFFICER` by default) approves them, mirroring the NOC request review workflow rather than the always-visible Feedback pattern. This keeps a single Placement Cell as the quality gate against copy-pasted or low-effort submissions, same as review of NOC requests.
- **Company is free text**, not a foreign key to `Company`, because students report on off-campus and pooled-campus interviews at companies the admin may never have added to the portal — the same reasoning already applied to `NocRequest.company`.
- **Submissions are locked after posting**: students cannot edit or delete their own entries once submitted, only admins can (edit is not yet implemented; delete is). This avoids a published, publicly-read record silently changing under readers after the fact.
- Endpoints live under `/api/v1/interview-experiences` (`FastAPI`): student submit/list-mine/browse-approved/company-list, and admin list/approve/reject/delete guarded by the new permission. Approval and rejection notify the author via in-app `Notification` and background email, matching the NOC/Feedback pattern.
- This is the 17th entry in the RBAC permission catalog; the RBAC user-management matrix picks it up automatically from `PERMISSION_METADATA` / `PERMISSION_DEFINITIONS`, no separate UI change needed.

## 2026-09-16 — Flag students on a missed-eligible-company streak

Added `GET /api/v1/students/admin/flags` (new `students` FastAPI router) and a "needs follow-up" badge/filter on `/admin/students`, so the placement cell can spot students who are eligible but not applying.

- **The rule is a consecutive streak, not a raw count**: a student is flagged when there exist 3 or more companies *in a row*, ordered chronologically by `registrationDeadline`, for which the student was shown eligible (via the existing shared `evaluate_eligibility`/`is_eligible` engine — no third eligibility algorithm) but applied to none of them. A student who skipped companies 1–2 and 6, applied to 3–5, is not flagged even though they skipped 3 total, because the misses aren't consecutive. This was an explicit product clarification, not the more obvious "eligible for 3+, applied to fewer than 3" reading.
- **Grouped by company, not by job profile**: a company posting two roles the student is eligible for counts once, and an application to either role clears that company's slot. Chronological position uses the earliest eligible job's `registrationDeadline` at that company.
- **Eligibility scope is "was ever shown", not "currently open"**: both `ACTIVE` and `ENDED` job profiles count; only `DRAFT` is excluded, since a draft was never visible to any student. This intentionally includes past drives so the flag reflects the whole season, not just what's still open.
- The heavy lifting (`compute_missed_streak`) lives in `app/services/student_flags.py` as a pure, DB-free function over plain dicts, unit tested directly in `backend/tests/test_student_flags.py` — the router only loads rows and shapes them into that function's input.
- The admin students directory (`/admin/students`) itself is still Prisma-direct (legacy, per the 2026-08-20 decision); this feature was added as a new FastAPI endpoint the page additionally calls via `backendFetch`, rather than porting the whole directory or adding a new Prisma call for it.

## 2026-09-17 — `cmdk` for searchable pickers; still no UI component kit

Refines the *UI system* section of `docs/PROJECT_CONTEXT.md` and the 2026-08-21 palette decision. The interview-experience form offers a curated list of ~1000 recruiters (`frontend/src/lib/company-options.ts`), which is unusable as a native `<select>` and awkward as a `<datalist>`.

`cmdk` is added as the single new UI dependency, wrapped by `frontend/src/components/common/company-picker.tsx`. It was chosen over a component kit deliberately:

- **Material UI** was rejected: it ships an Emotion CSS-in-JS runtime, the Material Design visual language, and its own `ThemeProvider`, which would run in parallel with the CSS-custom-property theme system from 2026-08-25 and fight it.
- **HeroUI** was rejected: it is configured as a Tailwind plugin through `tailwind.config.js`, and this repo runs Tailwind 4 with CSS-first config and no JS config file.
- **shadcn/ui** was not adopted wholesale, but is the right choice if a kit is ever wanted, because it copies source into the repository rather than adding a dependency. `cmdk` is the primitive its `Command` component wraps, so adopting shadcn later does not invalidate this. *(Superseded on 2026-09-18: shadcn now owns the admin forms and dialogs. `cmdk` survives underneath its `Command`, exactly as anticipated here.)*

Components remain styled with repository-owned semantic CSS in `globals.css` using the existing logo-derived tokens; `cmdk` is unstyled and contributes behaviour (filtering, keyboard navigation, `aria-selected`) only. Do not add a component kit without a new entry here.

The picker submits through a hidden input so the company rules stay in the Zod schema at the server boundary rather than being duplicated client-side, and `allowCustom` preserves the free-text company decision from 2026-09-15.

## 2026-09-17 — Teal palette replaces the logo-derived palette

Supersedes *2026-08-21 — Palette derived from the institute logo*. The blue/orange/green sampled from `iiitl-logo.png` is replaced site-wide, in both themes, by a single teal ramp chosen by the placement cell:

`#def7f9 · #92dce2 · #35bdc8 · #2ca0ab · #20808d · #1a6872 · #114f56 · #0b363c · #081f22`, anchored by `#091717` (darkest surface) and `#fbfaf4` (lightest surface).

- **The ramp is the only place literal brand hex values may appear.** It is declared once in the first `:root` block of `globals.css`; every rule reads a semantic token. The 2026-08-21 warning still applies and is the reason this migration was a token edit rather than another 108-replacement sweep.
- **Token names were kept, values remapped.** `--blue`, `--navy`, `--navy-deep`, and `--brown` now resolve to rungs of the teal ramp. Renaming them would have touched ~400 declarations across `globals.css` and `admin.css` for no behavioural gain; the names are now hue-inaccurate, which is the deliberate cost.
- **`rgba()` tints read channel tokens.** `rgba()` cannot consume a hex custom property, so `--brand-rgb`, `--deep-rgb`, `--shadow-rgb`, `--warning-rgb`, `--success-rgb`, and `--danger-rgb` carry the channels separately and are themed alongside the hex tokens. Previously these tints were frozen hex triplets that silently kept the old blue and orange when the theme changed.
- **Status hues deliberately survive the migration.** Green (success), orange (warning/pending/interview), red (error), and purple (shortlisted) are not teal. A monochrome portal would make the application funnel stages and the resolved/pending badges indistinguishable, so those colours now carry meaning only, never brand identity. Orange in particular was demoted: it was the CTA, eyebrow, and active-nav colour, and all of those are now teal.
- **Both sidebars share one gradient.** The student shell was navy and the admin shell was brown; they now both read `--sidebar-from`/`--sidebar-to`, with `--on-brand`, `--on-brand-soft`, and `--on-brand-muted` for text on those always-dark surfaces.
- The logo still renders on a white tile, for the contrast reason recorded in 2026-08-21. That has not changed and recolouring the logo is still not an option.

## 2026-09-17 — The dark theme is black with teal chrome

Refines *2026-09-17 — Teal palette replaces the logo-derived palette*, which is otherwise unchanged. That migration mapped every dark surface onto the teal ramp itself: the page was `#091717`, cards `#0c2124`, alternate surfaces `#0e2a2e`. The result was a uniformly teal dark theme in which nothing could accent, because the accent and the background shared a hue.

Dark mode is now black underneath with teal on everything layered above it.

- **The base is black and comes from two new tokens** declared alongside the teal ramp in the first `:root` block of `globals.css`: `--black-950` `#000000` for the page and for recessed input wells, and `--black-900` `#0d1112` for cards. `--black-900` keeps a trace of the brand hue (blue channel highest, red lowest) so it does not read as a second, unrelated grey palette. Previously these surfaces were loose inline hexes inside the `[data-theme="dark"]` block, which is why they drifted from the ramp; that block now reads tokens only, and the palette block stays the one place literal colour hexes appear.
- **Chrome is teal, not grey.** `--border` is `--teal-800`, `--border-subtle` and `--surface-highlight` are `--teal-900`, and `--surface-alt` is `--teal-950`. Card outlines, input outlines, table headers, row hovers, chips, and track backgrounds therefore carry the brand at the same lightness a neutral grey would have had. A neutral-bordered version was built first and rejected as too austere: with black surfaces, borders and headers are the only chrome large enough to carry brand identity.
- **Deep-fill tokens invert by theme.** `--navy`/`--navy-deep` are `--teal-800`/`--teal-900` on paper but `--teal-600` (`#20808D`) / `--teal-700` on black, because a deep teal button against a black page is unreadable. The token names describe the role, not the lightness — the same deliberate naming cost recorded in the parent entry.
- **`--blue` is `--teal-500` in dark, not `--teal-400`.** It must survive two jobs: 10px accent text directly on black, and an icon glyph on a `--teal-900` badge tile. `--teal-600` fails the second (2.8:1) and `--teal-400` reads as cyan rather than as the requested `#20808D` family; `--teal-500` clears both (6.7:1 and 4.1:1).
- **The login hero is the one surface with a theme-specific rule.** `.login-story` is a solid brand gradient on paper, but in dark mode it drops to the page black with a faint `--brand-rgb` glow and a `--border` divider, so the dark theme has no large teal field. It is the only place a component rule branches on the theme instead of reading a token; a `--hero-*` token pair for a single element was not worth it.
- Status hues stay untouched, per the parent entry. The light theme is unchanged. Verified in both themes against the admin shell, metrics, funnel, tables, toolbar inputs, form fields, banners, badge chips, and the login page.

## 2026-09-17 — Sign-in is email and password only; Google is removed

Supersedes *2026-09-17 — Password sign-in returns alongside Google* and, with it, the Google half of *2026-08-20*. `ADMIN_EMAILS` remains the only source of the `ADMIN` role, still matched on the exact domain and still recomputed per request.

Two sign-in methods on one page confused people, so there is now one. The Google provider, the Auth.js Prisma adapter, and `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are gone.

- **Removing Google removed the proof of mailbox ownership**, which several rules from the entry below leaned on. Those rules were rewritten rather than kept: elevation no longer clears a password, because with no second method that is a permanent lockout, and registration may now claim an existing account under the conditions below. What remains is a portal where possession of the password is the whole of identity.
- **The adapter went with it.** Credentials sign-ins are never persisted by Auth.js and sessions are JWTs, so `PrismaAdapter` had nothing left to do; `events.createUser` went too, since nothing creates a user through Auth.js any more. `Account`, `Session`, and `VerificationToken` stay in the schema but are no longer written. The permissions a placement team member used to receive automatically on first Google sign-in are now granted when an administrator provisions them on `/admin/users`.
- **Sign-in accepts `STUDENT_EMAIL_DOMAIN` plus the `ADMIN_EMAILS` allowlist; registration accepts the domain only.** The allowlist exception has to exist on the sign-in side, because a bootstrap administrator may hold an external address and Google is no longer there to let them in. It must not exist on the registration side, where it would hand out the `ADMIN` role that the allowlist grants.
- **Registration may claim an account that has no password, if it is a plain student.** Every student who used Google has a row and would otherwise lose their profile, applications, and resumes. A row that is privileged, that belongs to a listed team member, or that already has a password is never claimable, because claiming it would take over whatever it carries.
- **Provisioning has two roots of trust.** `npm run db:set-password -- <email>` works from the server shell and is how the first administrator, seeded from `ADMIN_EMAILS` without a password, gets one. After that, `/admin/users` has a set-password control for every account, which is also the recovery path: there is no reset email, so a lost password is an administrator's job.
- **The residual risk is now larger and should be stated plainly.** With no verified provider and no verification mail, whoever registers an unused institute address owns it. An administrator elevating an account is trusting that the right person holds it. A verification link at registration is still the single change that would fix this, and it matters more now than it did when Google existed.

## 2026-09-17 — Password sign-in returns alongside Google, institute domain only

Superseded the same day by the entry above; kept because the rules it introduced, and the reasons for them, still explain most of the current code.

Supersedes *2026-08-20 — Google-only sign-in* on the provider question only. Everything that entry says about `ADMIN_EMAILS`, exact-domain matching, and per-request role recomputation still holds.

The placement cell asked for both methods, for students and for staff. The Auth.js credentials provider is therefore back, but under rules the removed 2026-07-12 version never had: it authenticates real `User` rows rather than synthetic ids, and it cannot be the first thing that reaches a privileged account.

- **Password sign-in is bounded by `STUDENT_EMAIL_DOMAIN`, with no `ADMIN_EMAILS` exception.** `canUsePasswordAccount` is institute-domain only, so a password can never assert an address the institute does not control. An administrator on an external address keeps signing in with Google. This is narrower than Google sign-in on purpose: the allowlist is the emergency bootstrap, and a guessable password on an external mailbox is not an acceptable second key to it.
- **Registration refuses an address that already holds an account.** Seeded administrators and everyone who has ever used Google already have a `User` row. Attaching a self-registered password to an existing row would hand that row's role to whoever registered first, which is exactly the takeover the 2026-08-21 entry warned about.
- **Elevating an unprivileged account clears its password.** Enforced in the `signIn` callback during `ADMIN_EMAILS` reconciliation and in `PATCH /api/v1/users/{id}/role` with a matching Prisma fallback. Without this, someone could register a password on an unused institute address and wait for it to be made staff. Only a `STUDENT` password can have come from self-registration, so an already-privileged row keeps the password it set from inside a session; otherwise a super-administrator listed in `ADMIN_EMAILS` would lose their password on every Google sign-in.
- **Staff obtain a password from inside a session,** at `/account/password`, which any signed-in user reaches from the account menu in both shells. Changing an existing password requires the current one. This is the only path for an account that already exists, and it means a staff password is always backed by a Google-verified sign-in.
- **The accepted, deliberate gap: registration does not verify the mailbox.** This was chosen explicitly over verified self-registration and admin provisioning. An unused institute address can therefore be registered by someone who does not own it; if the real owner later signs in with Google, `allowDangerousEmailAccountLinking` links them into that row while the registrant still knows the password. The four rules above contain the blast radius to a single unprivileged student account. Sending a verification link before the account can sign in is the one change that closes it, and it is the first thing to add if this is ever exposed beyond the campus network.
- **Hashing stays in the Auth.js layer, not in FastAPI.** Sign-in happens before a session exists, so a backend endpoint would need a new unauthenticated surface plus its own service-token scheme. Auth.js and the Prisma adapter already own `User`, `Account`, and `Session`, so credential verification is the same concern. `bcryptjs` at cost 10: it is pure JavaScript, so it needs no native build in the standalone image, and the cost factor is also the request cost. SQLAlchemy mirrors `passwordHash` but the backend never reads it.
- **Online guessing is braked in-process,** eight failures per address per fifteen minutes, then a fifteen-minute lock. The counter is module state in `frontend/src/lib/login-throttle.ts`, so it resets on deploy and is not shared between replicas. Move it to Postgres or Redis before running the frontend at more than one replica.

## 2026-09-17 — Eligibility evaluates degree and gender; the engines take every criterion

`allowedDegrees` and `allowedGenders` had been collected on the job form and stored on `JobProfile` since the field was added, but neither engine read them, so a job restricted to B.Tech admitted an MBA student at apply time. Both engines now evaluate them, and the shape of the call changed to stop it happening again.

- **Every criterion is a required argument.** `evaluateEligibility` and `evaluate_eligibility` take degree, gender, and their allowed lists as required parameters rather than optional ones. TypeScript then refuses to compile a call site that forgets one, which is how all three frontend callers and all three Python callers were found. An optional argument defaulting to "unrestricted" would have reproduced the original bug for any future criterion.
- **An empty list means unrestricted, and so does `all` or `any`.** Jobs created before this change have empty lists and must keep behaving as they did; the form's own placeholder tells administrators to leave the gender field blank for all, and some will type a word instead. The `allowedDegrees` field is required on the form, so in practice the open case is gender.
- **A restriction the profile cannot answer fails.** A student with no `degree` is ineligible for a job that lists degrees. The alternative, passing an unset field, would let an empty profile satisfy a criterion the placement cell set deliberately. Neither field is part of `toEligibilityProfile`'s completeness guard, so a missing degree or gender still leaves a student eligible for every job that does not ask.
- **Degree and gender compare on letters and digits only** (`B.Tech`, `b tech`, and `BTech` all match), because both sides are free text. Branch keeps its older trim-and-uppercase rule: branch codes carry no punctuation, and loosening that comparison would silently widen eligibility on existing jobs.
- The job detail page now lists allowed degrees, and lists allowed genders when the job restricts them, so a student who fails a criterion can see the rule that failed.

## 2026-09-17 — NOC decision remarks are their own column

`NocRequest.message` held the student's remarks, and approving or rejecting overwrote it with the placement cell's, destroying the request's own statement of purpose and leaving the admin details modal labelling the cell's text "Student remarks".

`adminRemarks` is a new nullable column. `message` is written only by the student, `adminRemarks` only by a decision. Both are returned on the student-facing response, so `/forms` shows the rejection reason next to what the student originally wrote, and both appear as separate blocks in the admin details modal.

- **The approve and reject request bodies no longer accept `message` at all** — in the Pydantic schemas, the Zod schemas, and the form field names. A stray `message` is dropped rather than quietly treated as a decision remark.
- **Existing rows are not migrated.** For a request already decided, whatever is in `message` may be the student's text, the cell's, or the cell's written over the student's; there is no way to tell them apart, so no data migration guesses. Those rows keep `message` as-is and have a null `adminRemarks`. Demo seed data carries both fields.

## 2026-09-17 — The admin sidebar is derived from ROUTE_PERMISSIONS

`/admin/interview-experiences` was missing from `ROUTE_PERMISSIONS`, so `canAccessAdminRoute` fell through to its elevated-role check and a coordinator reached a page that `requirePermission(interview_experiences:manage)` then bounced. Separately, the sidebar rendered all twelve links to everyone, so a coordinator was invited to click "NOC requests" and be redirected.

The route is registered, and `ROUTE_PERMISSIONS` is now the single list the middleware, the page guards, and the navigation all read. `AuthenticatedAdminShell` computes the permitted paths on the server and `AdminShell` renders only those.

- **A route missing from `ROUTE_PERMISSIONS` is now hidden from the navigation** instead of being visible and ungated. Failing closed is the safer default, and it makes registering a new admin page part of adding one.
- Hiding a link is presentation, not authorization. The middleware and each page's `requirePermission` still decide access; nothing here relaxes them.

## 2026-09-17 — The application CSV is produced by the backend

The admin screen rebuilt the export client-side from the rows already in the browser, which dropped the Resume Label column that `GET /api/v1/applications/admin/export` produces and would silently have exported only the current page had the list ever been paginated. The endpoint existed and was never called.

The Export CSV control is now a link to `/api/admin/applications/export`, a route handler that checks `applications:manage` and proxies the backend with the session's bearer token; FastAPI's `require_admin` authorizes it again on the other side. A route handler rather than a server action because a browser download cannot attach the token itself.

- **The endpoint gained a `search` parameter** matching student name, email, roll number, job title, and company name, because the screen's free-text box is client-side only and the export has to cover the same rows the administrator is looking at.
- **There is no Prisma fallback.** Unlike the surrounding NOC and application actions, if the backend is unreachable the export fails with a 502 rather than falling back to a second implementation in the frontend; rebuilding the query in Next.js is what produced the divergence in the first place.

## 2026-09-17 — `Offer` is the placement record, and the only source of package statistics

The dashboard reported counts and percentages and no money at all, because the portal had nowhere to put an offer. `JobProfile.ctcStipend` is the advertised figure for a drive, shared by everyone selected from it, and an application stops at `SELECTED`, which says a student cleared a process and nothing about what they were offered.

`Offer` is a new table: student, company, optional drive, type (`FTE`, `PPO`, `INTERNSHIP`), status, season, money, location, offer and joining dates, and remarks. `GET /api/v1/analytics/admin/overview` aggregates it and nothing else.

- **An application is not an offer.** They are separate rows joined by an optional `applicationId`, unique so one application cannot produce two records. Offers made outside a portal drive — the majority in the first years of a placement cell — need no drive at all.
- **`ctc` and `stipend` are separate nullable columns, not one amount.** An annual CTC and a monthly stipend are different units; a single column would average 18,00,000 against 75,000 the first time somebody forgot which was which. The offer type decides which is required, in the Pydantic schema, in the Zod schema, and again in the router, and saving an offer clears the figure its type does not use.
- **A revoked or declined offer is excluded from every statistic but stays in the table.** `COUNTED_OFFER_STATUSES` in `backend/app/services/placement_stats.py` is the single answer to "which offers count", so a new query cannot quietly disagree with the dashboard. The office still needs to see those rows on the placement-records screen.
- **A PPO counts as a placement and is also reported on its own**, because the cell tracks internship conversion as its own number.
- **An offer with no amount recorded is excluded from the averages rather than counted as zero.** One incomplete row would otherwise report a lowest package of ₹0 for the season. The package count says how many offers carried a figure.
- **The season is stored on the offer** as the graduating batch year rather than derived from the student, so correcting a student's batch does not silently rewrite a closed season's results.
- Writes require `applications:manage` and reads `analytics:view`; no new permission was added, and the RBAC catalog stays at 17 entries.

## 2026-09-17 — The admin dashboard reads one backend endpoint and has no Prisma fallback

The page ran seven Prisma queries and did its own arithmetic. Adding packages, per-degree and per-branch distributions, and a season filter would have made that a dozen, in a page component, in the service that is supposed to be leaving direct database access behind.

`GET /api/v1/analytics/admin/overview?batch=` returns the whole screen: totals, package statistics, distributions, recruiters, funnel, and recent applications, all scoped to one season. `/admin/dashboard` renders that response.

- **There is no Prisma fallback**, unlike the older admin screens. Re-deriving these numbers in Next.js is exactly how the application CSV drifted from its endpoint (2026-09-17). If the API is unreachable the dashboard says so.
- **The season defaults to the newest one that has an offer**, not the newest that exists. The newest batch on file is usually next year's, whose drives have not run, and opening on an empty dashboard is not useful.
- **Totals that describe the register rather than the year — students, companies, active drives — are not season-scoped.** The funnel and recent applications are, through the drive's batch.
- Charts remain repository CSS rather than a charting dependency: a column chart of counts is a flex row with percentage heights, and a bar with one offer in it is still readable because every bar has a floor of 6%.

## 2026-09-17 — Announcements are drafted, published, and written on their own pages

Every announcement was live the moment it was saved, and one screen did composing and managing at once with a modal form.

`AnnouncementStatus` (`DRAFT`, `PUBLISHED`) and `publishedAt` are new columns, and the screen is now three routes under an expandable sidebar group: `/admin/announcements/company-event`, `/admin/announcements/general`, and `/admin/announcements` for active and drafts.

- **`PUBLISHED` is the default and an omitted status publishes.** Every existing caller and the seed data keep behaving as they did, and a forgotten field can never silently hide a notice the cell meant to send. Saving a draft is the deliberate act, and it is its own button rather than a dropdown, because the label has to say who will see the result.
- **Drafts are filtered out server-side for anyone without `announcements:manage`**, on the list and on the single-announcement route, which answers 404 rather than 403: the existence of a draft is not public either. The student dashboard's own Prisma query filters the same way.
- **`publishedAt` records the first time students could see it.** Withdrawing and re-publishing keeps the original date rather than pretending the announcement is new.
- **`Announcement.jobProfileId` links a company event to the drive it is about.** The composer narrows placement season → company → event, and that last choice has to land somewhere; without the column the control would be decoration. A general notice never carries one, and switching a company event to general clears both the company and the drive.
- **The composer locks its editor until the fields above it are filled**, listing what is missing. The sequence is the point: an announcement that does not know which drive it belongs to is the one that gets sent to the wrong batch.

## 2026-09-17 — Announcement attachments are rows, checked on their bytes, and served by status

A shortlist arrives as a spreadsheet and a venue map as an image, so an announcement had to carry files. Resume storage was the only upload path, and it is PDF-only by design.

`AnnouncementAttachment` is a new table, `POST /api/v1/uploads/admin/announcement-attachment` stores one file, and `validate_attachment` in `backend/app/core/storage.py` holds the closed type list.

- **Rows, not a URL array.** Students see a file name and a size, and both come from the upload rather than from parsing a storage URL.
- **The type is decided by the bytes, not the file name.** Every accepted extension has its signature checked — `%PDF`, the PNG and JPEG magic numbers, the ZIP header behind `.docx`/`.xlsx`, the OLE header behind `.doc`/`.xls` — and `.csv`/`.txt`, which have no signature, must decode as UTF-8 with no NUL bytes. An executable renamed to `.pdf` is the case this exists for. The resume rule is untouched and stays PDF-only.
- **The composer uploads before the announcement exists.** The author has to see the upload succeed while still writing, so files are staged under `announcement_docs/` and the owning rows are written on save. The cost is an orphan file when somebody abandons a draft, which is cheaper than the alternative of saving a half-written announcement to hold an upload.
- **Access follows the announcement's status.** A signed-in user may fetch an attachment once the announcement carrying it is published; a draft's file and a staged file nobody attached are private. Serving now sets the real media type, and anything that is not a PDF or an image downloads rather than rendering.
- **An omitted attachment list leaves the files alone; a supplied list replaces them,** and files dropped from it are deleted from storage. The edit modal sends no list, so editing text cannot silently discard a shortlist.
- **There is no Prisma fallback for the upload**, unlike the other admin writes. Recording a row that points at a file no service stored is worse than failing the upload.

## 2026-09-17 — One data table for every admin list

Eleven admin screens each rendered their own table: a `.admin-row` CSS grid with the column widths inlined per page, a hand-written search box, and a `useMemo` that filtered the array. None of them sorted, none of them paginated, and none of them let the viewer choose columns, so a thousand-row register was a thousand rows in the DOM.

`frontend/src/components/common/data-table.tsx` is now the only table in the admin portal, and `frontend/src/lib/data-table.ts` holds the pipeline behind it.

- **The pipeline is separate from the component and is the tested part.** Search, then filters, then sorting, then pagination, in that order, over plain arrays. Pagination running last is what makes a search that leaves 12 of 100 rows say "Page 1 of 1", and `frontend/src/lib/data-table.test.ts` pins that along with the comparator.
- **A column declares `sortValue` separately from what it renders.** Returning the raw number, `Date`, or boolean is what keeps 10 above 9.2 and orders a date by its instant; sorting the formatted cell is the failure this shape exists to prevent. A column with no `sortValue` is not sortable, which is the honest answer for an actions column.
- **Empty values sort last in both directions.** A missing CGPA is unknown rather than lowest, and burying it keeps the top of the column meaningful whichever way it is pointing.
- **Semantic `<table>` markup replaced the CSS grid rows.** `aria-sort`, header buttons, a sticky `<thead>`, and honest column widths come with it, and a wide register now scrolls sideways inside the card instead of squeezing every column to nothing.
- **Filters are multi-select, AND across fields and OR within one.** The page-level `<select>` controls that narrowed rows became these; the ones that change what is fetched, or that are not a value match, stay on the page and are passed through `toolbarExtras`.
- **Hidden columns persist per viewer in `localStorage`, read through `useSyncExternalStore`** the way the theme is, so the server render and the first client paint agree. One column always stays visible.
- **The table reports its view rather than owning what depends on it.** `onViewChange` is how the applications CSV keeps honouring the on-screen filters, how bulk selection covers the rows actually displayed, and how the team screen's reorder arrows know which rows they sit between.
- **The team table is neither sortable nor paginated.** Its order is the order the team is published in, and the move arrows are how it changes; a sortable column would quietly lie about what those arrows do.

## 2026-09-17 — Light mode moves to a neutral orange/teal palette; dark mode is untouched

Supersedes *2026-09-17 — Teal palette replaces the logo-derived palette*, for the light theme only. The all-teal identity read as a single dominant hue with no accent left to carry emphasis, and the placement cell asked for a whiter, more neutral admin surface with one warm accent for brand/CTAs and the existing teal demoted to a secondary, analytics-only colour.

Light-mode surfaces are now Zinc neutrals — `#fafafa`/`#ffffff` surfaces, `#18181b` ink, `#e4e4e7` borders — with `#f64900` orange-red as the primary brand accent and `#009689` teal as the secondary/analytics accent. `docs/PROJECT_CONTEXT.md`'s *UI system* section and the two hex swatches above are the current source of truth for light mode; the teal ramp entry above still describes dark mode correctly.

- **`--navy`/`--navy-deep`/`--blue`/`--blue-light` keep their names and swap roles, not just values.** `--navy` is now the primary orange (buttons, CTAs, active nav, chart's primary series); `--blue` is now the secondary teal (links, focus rings, icon chips, chart's secondary series). This is the same "rename touches ~400 declarations for no behavioural gain" trade-off recorded in the parent entry, now paying for itself a second time.
- **Dark mode is untouched by keeping the shared `--teal-*` ramp primitives unchanged** and only editing the light `:root` block plus a handful of previously theme-invariant component rules (chart bars, funnel bars, avatar chips, hero banners, profile completion bar) that used to hardcode a raw `var(--teal-NNN)` rung directly. Those rules now read `var(--navy)`/`var(--blue)` instead, which resolve to the new orange/teal in light mode but still resolve to the old teal-ramp rungs in dark mode (`--navy: var(--teal-600)` etc., unchanged) — so dark-mode pixels are the same or a near-identical same-family shift, never orange.
- **`--brand-rgb` and `--deep-rgb` anchor to orange, not teal**, because most of their consumers are CTA/interactive glows (focus rings, button shadows) that should carry the primary accent regardless of which token the bordered element itself reads. `--shadow-rgb` moved from a teal-tinted black to a neutral Zinc-900, so card shadows read as neutral elevation rather than a colour cast.
- **Warning was split from primary.** `--orange` (badges: pending/interview status) is now a true amber (`#d97706`), distinct from `--navy`'s brand orange (`#f64900`), so a "pending" chip can never be mistaken for a primary CTA.
- **All decorative gradients in the light theme were flattened to solid fills** — the sidebar gradient, chart bars, funnel bars, avatar chips, the login hero, and the profile/company banners — per the "minimal, no gradients" brief. The body page's ambient radial-glow background was removed in light mode; dark mode keeps its own separately-declared glow untouched.
- **The sidebars (student and admin) stop being a permanently-dark surface.** They no longer read `--on-brand`/`--on-brand-muted` (reserved for the few surfaces that stay a solid brand colour regardless of theme — the login hero and welcome/profile banners) and instead read the ordinary `--ink`/`--ink-secondary`/`--border` tokens, so in light mode the sidebar is white with a right border and dark text, matching the reference screenshots; in dark mode it still renders as the black/teal gradient panel from the parent entries, because `--sidebar-from`/`--sidebar-to`/`--ink`/`--border` all keep their dark-mode values.
- Verified by rebuilding the production frontend image and screenshotting `/login`: the hero, card, and primary button read as intended in both light-mode colour and contrast (the hero's `.eyebrow` and the sign-in button both needed a direct fix — they were still reading `--blue` from the pre-migration markup). Admin-only screens (dashboard, announcements) were reviewed by tracing every token and component-level colour rule rather than through an authenticated screenshot, since no admin credentials were available in this session.

## 2026-09-17 — Name, roll number, branch, degree, and batch are roster-owned and read-only to the student

`npm run db:import-students` (above) pre-provisions 444 real student rows from the placement office's roster, but `StudentProfileUpdate` and the student-facing `studentProfileSchema` still let a student overwrite their own name, roll number, branch, degree, and graduation year through `/profile`. A student editing their roll number or branch would desynchronise eligibility checks and placement records from the office's source of truth for no legitimate reason — those fields describe an administrative fact about the student, not something the student reports about themselves, unlike CGPA, contact details, or documents.

- **The five fields were removed from both schemas, not merely disabled in the UI.** `frontend/src/lib/profile-schema.ts`'s `studentProfileSchema` and `backend/app/schemas/student.py`'s `StudentProfileUpdate` no longer declare `name`, `rollNumber`, `branch`, `degree`, or `batch` at all, so a crafted request that includes them has nothing to bind to — Pydantic and Zod both silently drop unrecognised keys rather than erroring, which is the correct behaviour here (the rest of the payload still saves). A UI-only lock would have left the FastAPI route, and the Prisma-fallback path in `frontend/src/app/profile/actions.ts`, still accepting the field.
- **The institute email was already immune** — `email` was never part of `StudentProfileUpdate`; only `personalEmail` is student-editable, and the profile page has always rendered `email` as a disabled input.
- **The UI marks the same five fields permanently disabled** in `profile-view.tsx`'s `LOCKED_FIELDS`, independent of the page's edit/view toggle, with a tooltip pointing at the placement office. They stay visible — a student still needs to see their own roll number and branch — just never editable.
- **Degree was backfilled to `B.Tech` for every student whose `degree` was still blank** (444 rows, the just-imported roster), not for every student unconditionally: one demo account already carries `M.Tech`, deliberately, to exercise the degree split the admin dashboard charts (2026-09-17, admin dashboard entry) render. `import-students.ts` now also sets `degree: "B.Tech"` on create, so a future roster import doesn't need a follow-up backfill.
- Admin-side student editing is unaffected: `frontend/src/app/admin/users/actions.ts` is a separate, admin-only code path from the student-facing `/profile` route and schema touched here, so the placement office can still correct a roster typo.

## 2026-09-17 — Four roles, a granular permission catalog, and the admin gate stops counting

Supersedes the 5-role hierarchy (`STUDENT`, `COORDINATOR`, `OFFICER`, `ADMIN`, `SUPER_ADMIN`) and the 17 coarse `module:action` permissions recorded under *Authentication/RBAC* in `docs/FEATURE_STATUS.md`. The placement cell asked for four named roles and for permissions granular enough that a volunteer can read what the team writes.

Roles are now `SUPER_ADMIN`, `PLACEMENT_TEAM`, `PLACEMENT_VOLUNTEER`, `STUDENT`, and the catalog is 49 dot-separated keys (`companies.view`, `jobs.publish`, `applications.view_own`, …) declared once in `frontend/src/lib/permissions.ts` and mirrored exactly in `backend/app/core/security.py`.

- **The admin gate asks *which* permissions are held, not how many — this was a live privilege-escalation bug waiting to happen.** `requireAdmin()` and the middleware decided admin access with `customPermissions.length > 0 || effectivePermissions.length > 0`. Any account holding one custom permission — including a *revocation* like `-jobs.view`, which is also just an array entry — passed. Passing then set `isAuthorized = true` in `frontend/src/app/api/resumes/[id]/route.ts`, `.../noc-documents/[id]/route.ts`, and `.../identity-docs/[type]/preview/route.ts`, whose ownership checks are written `if (!isAuthorized && row.userId !== currentUserId)` — so ownership was skipped entirely, and the identity-document route additionally takes its `studentId` from the request body. It was latent only because `STUDENT` defaulted to `[]`. **This change gives students `_own` permissions by default, which would have turned it into an IDOR over every student's resume, NOC document, and encrypted Aadhaar/PAN.** `hasAnyAdminPermission` / `has_any_admin_permission` now test membership against `STUDENT_SCOPED_PERMISSIONS`, and those three routes require a concrete permission (`students.view` / `noc.view`) rather than "the admin check did not throw".
- **`rbac.manage` is separate from `users.manage`, and only `SUPER_ADMIN` holds it.** Previously anyone with `users:manage` could assign any role, including `SUPER_ADMIN`, to anyone including themselves; the only guard was a "last administrator" check. Role assignment, the permission matrix, and creating a user with a non-`STUDENT` role or a permission grant all now require `rbac.manage`, in both `frontend/src/app/admin/users/actions.ts` and `backend/app/routers/users.py`.
- **`canAccessAdminRoute` matches the longest route prefix, and defers to the admin gate first.** `/admin/announcements/company-event` needs `announcements.create`, but first-match iteration let its parent `/admin/announcements` answer for it with mere view access. Separately, students legitimately hold `companies.view` and `jobs.view` — those are how a student browses drives — so the route table alone cannot decide admin access; it now requires `hasAnyAdminPermission` first, which keeps it consistent with the middleware.
- **Redirects resolve to a route the account can actually open.** Bouncing a failed route check to `/admin/dashboard` loops forever for anyone who cannot open the dashboard, which is now possible. `firstAccessibleAdminRoute` picks the first route they hold, falling back to `/dashboard`.
- **The enum migration carries an explicit mapping.** Postgres cannot drop an enum value, and Prisma's generated cast would drop rows holding a removed one, so `20260917180000_rbac_four_roles` rebuilds the type with a `CASE`: `COORDINATOR`→`PLACEMENT_VOLUNTEER`, `OFFICER`→`PLACEMENT_TEAM`, `ADMIN`→`SUPER_ADMIN`. The single `ADMIN` row is the bootstrap office account, already all-powerful through `ADMIN_EMAILS`, so promoting it grants nothing it did not have. No row held `customPermissions`, so no permission-key data migration was needed.
- **Existing sessions were not force-invalidated.** Old JWTs carry the previous role and permission claims and resolve to fewer permissions until the holder signs out and in. Rotating `AUTH_SECRET` would have logged out all 456 students to fix claims that only staff accounts have.
- **`/admin/settings` is Super Admin only and volunteers get no `users.view`.** The matrix asked for "limited settings" and "view limited users"; neither has a read-only surface built, and `/admin/users` *is* the RBAC console, so a read-only view of it still exposes every account's effective permissions. Volunteers use `/admin/students` for the directory they need.
- **No `audit.*` permissions.** There is no audit-log model or screen in this codebase, and a permission guarding nothing is worse than no permission.
- `applications.py` (5 routes) and `uploads.py` (2) moved off the coarse `require_admin`, which now means only "is this an administrative account at all" and is documented as the wrong question for a route to ask. While there, `GET /uploads/files/{path}` stopped loading one arbitrary NOC row to compare against, which 403'd a student who had two NOC documents.

## 2026-09-17 — The palette is the institute blue: #1F3A60 on white, and on black

Supersedes *2026-09-17 — Light mode moves to a neutral orange/teal palette; dark mode is untouched*. The placement cell settled on one brand colour, `#1F3A60`, and asked for white and grey everywhere else in light mode and an all-black dark mode carrying the same blue. The orange primary and the teal secondary are both gone.

`--brand-50` … `--brand-950` replaces the teal ramp in the first `:root` block of `globals.css`. Every rung sits on hue 215°, and **`--brand-800` is exactly `#1F3A60`** — the colour as given, not an approximation of it.

- **The ramp is named for the brand, not for a hue.** The previous two migrations kept `--teal-*` while remapping its values, which the 2026-09-17 entry called "the deliberate cost". Only 11 references remained, all inside the dark block, so the names were corrected rather than paying that cost a third time. `--navy` and `--blue` keep their (hue-inaccurate) names because those are the ~400-declaration ones.
- **Light mode is white, grey, and one blue.** Surfaces and type stay the Zinc neutrals; `--navy` is `--brand-800` for primary fills and `--blue` is `--brand-500` for links, focus rings, and the secondary chart series. 500 rather than 400 because 500 clears AA on white (5.1:1) and 400 does not.
- **Dark mode is black with the brand as its chrome.** `--border` *is* `#1F3A60`, so the colour the cell chose is the edge you actually see against the page black — the role teal-800 used to play. Fills stay mid-ramp for the reason recorded in the parent entry: white on `#1F3A60` is 11.5:1 on paper but the fill itself is 1.8:1 against black, so `--navy` is `--brand-600` (white text at 7.4:1) and `--blue` is `--brand-400` (6.2:1 as accent text directly on black, where 500 would fall to 4.1:1).
- **The near-blacks and the near-white were re-tinted.** `--black-900`, `--ink-black`, and `--paper` carried a teal cast; they are now cool/blue-tinted so black surfaces and the text on them read as one palette rather than two.
- **Status hues survive again.** Green, amber, red, and purple still carry meaning only. The amber deadline banner reads `--warning-rgb` and is genuinely a warning; the multi-hue metric chips are a categorical set, matching the reference screenshots the cell supplied.
- **shadcn inherits all of this for free.** The `@theme inline` bridge added alongside shadcn maps `--color-primary`, `--color-border`, `--color-ring` and friends onto these same semantic tokens, so the migrated identity-document rows changed colour with the rest of the portal and needed no edit.
- Verified by screenshotting `/login`, `/dashboard`, and `/profile` in both themes against the running stack, and by reading the computed tokens back out of the document.

## 2026-09-18 — Add Company gets its own page, and a company carries a round

Extends the events pass to the recruiter record. The modal in the companies list has been replaced by a page, for the same reason the event modal was: the cell reads a company out in a fixed order and the dialog could not hold the fields.

- **`/admin/companies` lists, `/admin/companies/add` composes, `/admin/companies/[id]/edit` edits.** One `company-form.tsx` serves both write screens; the list's edit action is now a link. The sidebar group gained *All companies* alongside the *Add company* and *View registrations* that the 2026-09-17 navigation refactor put there — the reference design has no list link at all, but a list holding the only delete control has to be reachable.
- **The actions enforce `companies.create`/`companies.update`/`companies.delete`.** They asked only for an admin session before, so any admin-portal account could register or remove a recruiter. Which grant is checked depends on whether an id was posted, because creating and correcting are separate permissions.
- **Category is a closed list of two: Dream and First Round.** The reference screen shows *Dream* and *A++*; the cell asked for the dream/first-round distinction instead, and it is a real rule rather than a label — a dream-round company stays open to a student who already holds an offer. Nothing consumes `Company.category` yet, so eligibility does not act on it; the column records the intent that a later eligibility change can read.
- **`placementSession` is the season the record was raised for.** The same idea as `JobProfile.placementYear`, named for the label this screen uses. It is nullable, unlike `placementYear`, because a company predating the column has no honest value and a backfill from `createdAt` would invent one.
- **Turnover is free text.** Companies state it in their own currency and unit ("USD 4.2 billion", "₹300 crore"); a number column would have to invent both. The same rule `cap`, `companyBond`, and `duration` follow on an event.
- **Company info is now required.** `description` stays nullable in the database for the rows that predate this, but the form refuses a bare name, because a company with no description renders as "No company info" everywhere a student sees it.
- **Website and logo are no longer editable, by request.** The reference card does not carry them, so the form omits them; the columns and the data stay, and `saveCompany` deliberately omits both from its write payload so editing a seeded company does not erase them. This does mean the logo that students see on the dashboard feed and their applications can no longer be set from the portal — a real regression, taken knowingly, and listed as the next work on the companies row in `FEATURE_STATUS.md`.
- **The duplicate-check acknowledgement gates creation only.** The server already refuses a case-insensitive duplicate name; the checkbox is what stops a second record being raised for a company spelled slightly differently, which the server cannot catch. It is absent when editing, where the record demonstrably exists.

## 2026-09-17 — Job profiles become Events, composed on their own page

Renames the surface the 2026-08-20 boundary calls "admin job profiles". `JobProfile` remains the table and `jobs.*` remains the permission family; only the screens and the routes change, because the placement cell calls these company events and the old modal could not hold the fields they actually read out.

- **`/admin/events` lists, `/admin/events/add` composes, `/admin/events/[id]/edit` edits.** The sidebar carries an expandable `Events` group with *All events* and *Add event*, the same shape Announcements has. `/admin/job-profiles` stays as a `permanentRedirect` and stays registered in `ROUTE_PERMISSIONS`, so older links still resolve for an account that only holds `jobs.view`.
- **One form serves add and edit.** `frontend/src/components/admin/event-form.tsx` replaces the modal in the old manager; the list's edit action is now a link to a page rather than a dialog. A second, divergent editor was the thing worth avoiding.
- **The actions enforce `jobs.create`/`jobs.update`, and `jobs.publish` on top when the status is `ACTIVE`.** Previously `saveJobProfile` asked only for admin session, so any admin-portal account could publish a drive. Drafting an event is not publishing one, the rule announcements already follow.
- **Placement year is now a column of its own.** `JobProfile.placementYear` is the season the drive runs in; `batch` stays the graduating cohort it recruits. They were one field, which is wrong for an internship that recruits the batch below its own season. Existing rows were backfilled from `batch`, which is the only faithful guess.
- **Category is a closed list of four: Tech, NonTech, Management, Marketing.** `jobCategory` was free text. "Core" was deliberately left out of the list — the cell does not run core-engineering drives — so it is refused at the schema boundary, not just absent from the buttons. Rows written before this — including everything the demo seed still creates — carry legacy strings and are shown as-is on the list; editing one forces a choice from the four.
- **Cap, company bond, and duration are free text, not parsed figures.** They are quoted from the company ("2 years bond", "6 months") and the office needs them to read back exactly as stated. A numeric `cap` would have to invent a unit.
- **Degrees and branches are offered from the roster, not a hardcoded list.** `frontend/src/lib/event-options.ts` reads the distinct degree/branch pairs held by student accounts and groups branches under their degree, so eligibility can never name a cohort that does not exist. A drive being edited keeps any value the roster no longer explains, grouped under *Other*, rather than silently dropping it.
- **`react-day-picker` is the second behavioural UI dependency, after `cmdk`.** The deadline is a day and a time, and `datetime-local` gives neither a month grid nor quarter-hour slots. Its own stylesheet is *not* imported, because it carries literal colours; the `rdp-*` classes are styled in `admin.css` from the semantic tokens, the same rule `cmdk` follows.
- **Not built, and visible in the reference design: the per-event question builder, the attachment uploader, and a point of contact.** `JobProfile.attachments` and the `Coordinator` table exist but nothing writes them, and custom questions would need answer storage on `Application`. Rendering any of the three would have been a control that describes persistence the portal does not have.

## 2026-09-18 — shadcn/ui owns the admin forms and dialogs

Supersedes the shadcn bullet in *2026-09-15 — cmdk for the company picker*, which recorded that no kit had been adopted. shadcn was already installed — `components.json`, the Radix and `cva` dependencies, six primitives, and the `@theme inline` bridge — but only `identity-document-row.tsx` used it. This pass adopts it for the admin write surfaces.

- **The token bridge stays the boundary.** shadcn utilities keep pointing at the repository's semantic tokens rather than shadcn's zinc palette, so a migrated control inherits the institute blue and both themes with no per-component edit. Nothing here changes the 2026-08-25 colour decision.
- **Migrated: both composer forms and all twenty admin dialogs.** `company-form.tsx` and `event-form.tsx` are Card/Label/Input/Textarea/Checkbox/Switch/Select/ToggleGroup/Popover/Command. Every `.modal-backdrop` dialog under `components/admin` plus the two shared pickers now render through Radix.
- **`components/common/admin-dialog.tsx` is the one dialog shell.** Each manager previously hand-rolled a backdrop, a close button, and a mousedown-to-dismiss handler, and **none of them trapped focus or closed on Escape**. Radix supplies the focus trap, Escape, scroll lock, and portal. `CompanyPicker` additionally loses a hand-rolled `createPortal` that existed only to escape a parent's `backdrop-filter` containing block.
- **Semantics improved where the old markup faked a control.** Category pills were `<button>`s and are now a radio group; the duplicate-check acknowledgement was a `<button>` with an `<i className="box">` and is now a real checkbox; the degree and branch lists likewise. This was the migration's main non-visual gain.
- **Alert carries the status hues.** shadcn's `Alert` has only `default` and `destructive`, both neutral-backed, which would have flattened a "saved" banner to grey. `success` and `info` variants were added to the primitive reading `--badge-green-bg`/`--green` and `--badge-blue-bg`/`--blue`, because green, amber, and blue carry meaning here.
- **The missing `@layer base` rule was the real bug this uncovered.** shadcn components ask for a bare `border`, whose colour in Tailwind is `currentColor`; without shadcn's own base layer, every card, input, and dialog drew a near-white hairline in dark mode and a near-black one in light. `globals.css` now carries `@layer base { * { @apply border-border outline-ring/50 } }`. It is layered, so the unlayered hand-written rules still win wherever they name a colour.
- **A select cannot hold an empty value.** Radix rejects `SelectItem value=""`, so the two genuinely clearable pickers — an announcement's company and a placement record's drive — use a `__none` sentinel and post the real empty string through state or a hidden input. Server action payloads are unchanged; the full list of posted field names was diffed against the pre-migration files.
- **Not migrated, deliberately: the student portal.** `profile-view.tsx` alone holds ten dialogs, and `forms-view`, `dashboard-feed`, and `interview-experiences-view` hold more. They still use `.modal-backdrop`, which is why that CSS survives. Admin list *tables* are also untouched: `data-table.tsx` stays bespoke, so shadcn's `Table` is not in the repo.
- **Known cosmetic regression.** Radix renders a select's value on the client, so the Placement Year and Batch triggers paint blank for one frame before hydration where a native `<select>` showed the value immediately.

## 2026-09-18 — The admin data grid follows the reference portal's structure, not its palette

Every admin list already rendered through one `DataTable`, so standardising the
portal was a restyle rather than a migration. The grid now follows the NSUT
reference layout: a section heading carrying the live row count, right-aligned
list actions beside it, and one bordered card holding the 440x44 search, the
grid, and the pagination. The metrics are the reference's — a 50px light header
at 15px/600, 61px rows at 15px, a 12px card radius, no zebra striping and no
shadow.

The reference's own colours were not adopted. Its pink-red accent (#FF1744),
#111111 ink and #FFFFFF page have no rung in the ramp this portal fixed on
2026-09-17, and a literal accent would have had nothing to say in dark mode.
The grid therefore reads its colours from the existing tokens, which is why the
same markup renders as white-on-white in light mode and near-black with navy
chrome in dark mode. Only the structure, density and type scale were copied.

Two smaller decisions came out of the same pass:

- Pinned columns measure their offsets instead of deriving them. A column's
  declared `width` is a minimum that padding and content routinely exceed, so
  accumulating declared widths put every column after the first at too small an
  offset and they overlapped by the difference. The offsets are now read from
  the rendered header widths through a `ResizeObserver`.
- 56 column `width` values were `minmax(120px, 1fr)`, a CSS Grid function that
  is invalid on a table cell and had always been dropped. They are now the px
  minimum each one already named, which is also what makes pinning possible.

Plus Jakarta Sans is gone; a single typeface carries the portal, headings
included. That was Inter at the time, and is IBM Plex Sans since 2026-09-20.

## 2026-09-18 — One Makefile is the operational entry point, and Docker is the only prerequisite

Running the portal used to take a documented sequence: copy `.env.example`,
generate two secrets by hand, `docker compose up --build`, then a handful of
`npm run db:*` commands that needed Node 20, an installed workspace, and a
`DATABASE_URL` pointing at localhost rather than at the `db` service. The
database tooling was the only part of the stack that was not containerised, so
the commands that populate a database could not be run by someone who had only
Docker.

A root `Makefile` is now the entry point. `make up` builds, starts, and blocks
until every container reports healthy; `make seed` applies migrations and loads
administrators, the student roster, and the demonstration dataset in a
single container run. Everything else is a subcommand of those two, and
`make help` is generated from the `##` comment on each target, so the list
cannot drift from the file.

Three things made that possible:

- **A `tools` service**, sharing the `migrate` image and its environment through
  a YAML anchor, gated behind a Compose profile so `up` never starts it. Every
  `make db-*` target is `docker compose run --rm tools <script>`, which puts the
  script on the stack's network with the in-cluster `DATABASE_URL` already set.
  `database/seed-data/students.json` is copied into that image as part of
  `database/`, since the roster import reads it from there.
- **`.env` is a Make file target**, not a documented step. Any target that needs
  configuration depends on `.env`, so a first-time contributor gets one written
  from `.env.example` with a fresh `AUTH_SECRET` and `ENCRYPTION_KEY` instead of
  a missing-variable error from Compose.
- **`make admin EMAIL=…` edits `ADMIN_EMAILS` and reseeds.** Administrator
  access still has exactly one source, and the address still comes from the
  person running the command; the Makefile only removes the hand-editing step.
  Nothing in it defaults to an address.

Two targets deliberately stay on the host. `make db-pack-demo` writes
`seed-data.zip` back into the working tree, and `make check` runs the npm
scripts a contributor already has installed; containerising either would trade
a real benefit for a bind mount and a slower loop.

## 2026-09-18 — Placement records can be entered a drive at a time, and an offer states its own role

A season's outcome arrives as a list: one company, one package, one status,
and forty roll numbers. Entering that through the single-record dialog meant
re-selecting the company and re-typing the package forty times, with the
student picker holding the whole roster on every open.

`/admin/placement-records/add` sets the configuration once and applies it to a
pasted list of roll numbers. The single-record dialog stays on the list page:
correcting one row is still the common case, and the bulk screen is the wrong
shape for it.

Three decisions inside that:

- **Roll numbers, not ids.** The office pastes a column out of a spreadsheet,
  so the screen accepts commas, spaces, tabs, newlines and semicolons, upper-
  cases, and de-duplicates while keeping the entered order. `parseRollNumbers`
  is the single definition of that, shared by the chips in the browser and the
  server action, so the two can never disagree about what was entered.
- **A partial result, not all-or-nothing.** One mistyped roll number in a paste
  of forty must not discard the other thirty-nine. `POST /api/v1/offers/bulk`
  writes what it can and returns every roll number it could not record with a
  reason: no such student, not a student account, or already holding that
  record for the season. The last one is what makes a re-submitted paste safe.
  The amount rule is unchanged — a bulk run is still refused without the CTC or
  stipend its type requires, because recording forty rows at once is not a
  looser kind of recording.
- **`Offer.jobTitle` is a real column.** The role used to be read from the
  linked drive, which leaves an off-portal offer with no role at all and cannot
  express an offer for a role the drive was not named after. The column is
  nullable and reads fall back to `jobProfile.title`, so every row written
  before it keeps showing the role it always showed, and no backfill freezes a
  title the drive can still be renamed to.

The type and status vocabularies were left alone. The reference portal names
its own — Placement, Summer Internship, Winter Internship, PPO against
Offered, Accepted, Rejected, Withdrawn, Upgraded to PPO — but `OfferType` and
`OfferStatus` already carry meanings the dashboard aggregates on, and renaming
`DECLINED` to "Rejected" would have moved which party gave the offer up. The
new screen therefore uses the same two dropdowns as the rest of the portal.

## 2026-09-18 — The hand-written stylesheets sit in `@layer components`

`globals.css` and `admin.css` were unlayered, so every rule in them beat every
Tailwind utility regardless of specificity: an unlayered declaration outranks
anything in a layer. shadcn components carry their variants as utilities, so a
converted control kept whatever the old stylesheet painted and the migration
was skin deep wherever the two met. It also produced workarounds that read as
noise — `h-auto` on the auth controls to release a height the component had
already set, `!`-flagged utilities in the NOC view, legacy classes kept on tab
strips and filter pills purely to win the cascade.

Both stylesheets now sit in `components`, which the Tailwind import orders
before `utilities`, so a utility at the call site wins. `admin.css` is layered
at its `@import` rather than by wrapping the file. Element resets moved to
`base`: unlayered, `button, input, select, textarea { font: inherit }` was
overriding the `text-sm` a shadcn Button carries, so the component's own type
scale had never applied anywhere.

The consequence to know about: a legacy rule and a utility that name the same
property now resolve the other way round. Where the legacy rule was the
intended design, say so with a utility at the call site — the auth inputs now
carry `h-11` instead of inheriting 44px from a `.login-fields input` rule that
has been deleted. Reach for `!` only when a third party owns the element.

## 2026-09-18 — `allowedDevOrigins` covers both loopback spellings

The dev server runs in a container published on `0.0.0.0`, so it is reached by
whichever host name the developer types. Next refuses to serve dev chunks to an
origin it was not told about, and the refusal is silent in the browser: the
page server-renders and then never hydrates, so nothing on it responds to a
click and the application looks broken rather than misconfigured. Both
loopback spellings are listed so that failure mode cannot recur.

## 2026-09-18 — A database table browser sits at `/admin` on the backend

The placement office needed to correct a row the admin portal has no screen
for, and the alternatives were a psql prompt or Prisma Studio on a second
port. `sqladmin` mounts over the SQLAlchemy models already in
`backend/app/models/db.py`, so this is a view of the existing data layer and
not the third one `AGENTS.md` prohibits. A column added by a Prisma migration
and mirrored into those models appears here without a third edit.

Two `/admin` paths now exist and they are different things. The frontend's is
the product surface and is bound by the RBAC catalog in
`app/core/security.py`. The backend's reads and writes every column of every
table, including `passwordHash` and the AES-256-GCM identity ciphertexts,
consulting no role at all. It has no key, so it shows ciphertext and never
plaintext; the rule about never returning a raw Aadhaar or PAN still holds.

Because it goes around RBAC, the password is the whole boundary:

- `DB_ADMIN_PASSWORD` empty is the off switch. A deployment that has not heard
  of this feature is not serving it.
- Under 16 characters, the mount is refused. Guessing rights over every row is
  worth a long password.
- In production it may not equal `AUTH_SECRET`, which would put the
  session-signing token into a form field and a browser's history.
- A refusal logs and leaves the API alone. A weak password should cost the
  operator the screen, not the portal.

It is allowed in production deliberately, so the office can fix live data. The
operator's job is keeping port 8000 off the public internet. The session
cookie is its own (`tnp_db_admin`), signed by a key derived from `AUTH_SECRET`
rather than being it, expires in two hours, and is `Secure` in production.

Portal accounts are deliberately not accepted. Their passwords are bcrypt
hashes written by `frontend/src/lib/password.ts`, and checking one here would
be a second implementation of that comparison on the service designed never to
see a password.

Two details follow from Prisma owning the schema. `cuid()` runs in the Prisma
client and the migrations give `id` no database default, so a row created here
generates its own key — ordered by time, random-tailed, opaque as every id in
the portal already is. And a primary key that carries meaning, like
`SystemSetting.key`, is asked for rather than invented.

It has a dark mode, keyed on the `tnp-theme` value the portal's own theme
provider already writes. The bundled Tabler 1.4 carries a full dark palette
behind `[data-bs-theme]` but never sets it and does not read
`prefers-color-scheme`, so the templates in `backend/app/admin/templates/`
choose the value in an inline head script — before the first paint, because
setting it later shows a white page that snaps to black. The two vendored
widgets that are not Tabler's, select2 and flatpickr, ship light-only
stylesheets and are restyled from Tabler's own variables rather than from a
second palette. Those templates extend sqladmin's through its
`sqladmin_original/` prefix instead of replacing them, so an upgrade that
changes their markup still reaches us. The storage key is shared with the
portal deliberately: the two are separate origins today and the value does not
actually carry across, but one project should not hold two spellings of the
same preference.

## 2026-09-20 — IBM Plex Sans, and a heading weight the portal can't shout with

The complaint was that the portal looked generated, and the typeface was only
part of it. Every heading in both stylesheets — 41 of 42 — was `font: 800`,
from a 64px login headline down to 12px table labels, and fourteen of them
also pulled the letters together with tracking as tight as `-0.05em`. Inter at
ExtraBold with heavy negative tracking is the house style of the AI-generated
landing page, so changing only the family would have kept the feel.

IBM Plex Sans replaces Inter. It was drawn for interfaces dense with data
rather than for marketing pages, which is what these screens are, and it has a
neutral institutional voice that suits a placement office. Its heaviest weight
is 700, so the ExtraBold-everything look is no longer reachable by accident.

The treatment changed with it:

- Headings are 600. The hierarchy here was always carried by size rather than
  weight, so lightening every heading by the same amount keeps the structure
  and drops the shouting.
- Negative tracking is a display-type technique and now only applies above
  24px: `-0.02em` at 32px and up, `-0.01em` from 24px, and nothing below,
  where it was only making letters collide. The positive tracking on the
  uppercase eyebrow labels is correct and stayed.
- The data grid declares `font-variant-numeric: tabular-nums` on `.dt-table`
  rather than per column. Plex's proportional digits are drawn to sit in a
  sentence, so a column of CGPAs came out ragged down its decimal point. At
  the table level a column added later is aligned without anyone remembering,
  which the 14 hand-tagged `.dt-numeric` cells demonstrably could not manage;
  that class is gone.
- IBM Plex Mono is loaded for one job, `.identifier`: roll numbers and record
  ids. `2023UCS1632` and `2023UCS1362` share a silhouette in a proportional
  face, and a roll number is the one string a reader compares character by
  character.

Both faces are self-hosted through `next/font` with only the weights the
stylesheets use, since Plex is not a variable font on Google Fonts.

One trap is worth recording. The `next/font` variables are named
`--font-plex-sans` and `--font-plex-mono`, not `--font-sans`/`--font-mono`,
and `@theme inline` maps Tailwind's keys onto them. Naming them after the
theme keys directly does not work: `@theme inline` substitutes values into
generated utilities instead of emitting custom properties, so a hand-written
`var(--font-sans)` resolves to nothing — and an invalid `var()` inside a
`font` shorthand voids the whole declaration rather than falling through to
the next family in the list, which renders the entire portal in the browser's
default serif. The mapping exists so that a shadcn component reaching for
`font-sans` gets Plex rather than the system UI font.

## 2026-09-20 — Both shells run on shadcn's Sidebar, at a readable size

The two navigation rails were hand-rolled and nearly identical: a fixed
`aside`, a CSS-transform drawer below a breakpoint, a floating hamburger, a
close button and a backdrop, written once in `globals.css` for students and
again in `admin.css` for staff. 173 lines of CSS between them, two places to
fix anything, and no keyboard affordance.

Both now render `components/ui/sidebar`, which brings the drawer, the
focus trap, the `Cmd/Ctrl+B` shortcut and the cookie-persisted open state with
it. The admin groups use `Collapsible` with `SidebarMenuSub`, so the
permission filtering that decides which children an account sees is unchanged
— it still runs over `allowedPaths` before the menu is built.

Three deliberate departures from what `shadcn add sidebar` generates:

- **Type size.** Rows are 15px on 40px, sub-rows 14px on 36px, against the
  generator's 14px on 32px. The nav this replaced was 12px with 11.5px
  children, which is what made it look cramped. The width went to 17.5rem so
  that "Interview experiences" still sits on one line.
- **Colour.** The generator writes eight literal `hsl()` values for
  `--sidebar-*` and a `.dark` block to match, which would be the only colours
  in the project not derived from the brand ramp. They are aliases onto the
  existing tokens instead — `--sidebar` is `--sidebar-from`, `--sidebar-accent`
  is `--surface-alt`, and so on. Every one of those already has a dark value,
  so a single declaration covers both themes and there is no `.dark` override
  to keep in step.
- **The active row.** `data-[active=true]` is the institute blue on
  `--navy-soft-bg` with a bold navy label, carried over from the old
  stylesheet. The generator's `bg-sidebar-accent` is the same grey as hover,
  which tells a reader where the pointer is rather than where they are. It
  first shipped with a left-edge inset-shadow marker too, dropped 2026-09-20
  after it read as a stray blue sliver rather than a boundary; the tint and
  the bold label carry "current" on their own.

`collapsible="icon"`, so collapsing leaves a rail rather than nothing: the
data grids behind these screens are wide and regularly want the room, but an
admin mid-task should not have to reopen the whole nav to reach the next
screen. That is also what makes the `tooltip` on each row reachable.

Two bugs in the generated code were fixed rather than suppressed, because the
repository's `react-hooks` rules reject both:

- `SidebarMenuSkeleton` picked its width with `Math.random()` inside a
  `useMemo`. Beyond the purity rule, the server and the client roll different
  numbers, so every skeleton row was a hydration mismatch. It hashes `useId()`
  now, which keeps the varied widths and is stable across both.
- `useIsMobile` set state synchronously inside an effect. It is
  `useSyncExternalStore` now, with `false` as the server snapshot, which is
  the shape React added that hook for: a media query is an external store.

## 2026-09-20 — Announcements and events are cached in Redis, keyed by who is asking

The student dashboard and the company-events list are the two screens every
signed-in student loads, and both rebuilt the same rows from Postgres on every
request. They are now read through `GET /api/v1/announcements` and
`GET /api/v1/jobs`, which sit behind a Redis cache in `app/core/cache.py`.

**Cached in the API, and the hot reads moved there to meet it.** Putting the
cache behind the FastAPI endpoints is where `AGENTS.md` says data access
belongs, but those two pages queried Prisma directly and so would not have
touched it. Caching the Prisma calls where they stood would have been quicker
and would have deepened the dependency the data layer is trying to shed, so
the reads moved instead. This is the migration the project was already
committed to, done for the two pages that most justify it.

**The viewer is part of the key.** `announcements.view` decides whether a list
includes drafts. A cache keyed only by the query string would let whoever
asked first decide what everyone else sees, so `get_or_set` takes a mapping
that names the visibility alongside the filters. Per-viewer results are not
cached at all: `GET /api/v1/jobs/{id}` caches the drive and recomputes
eligibility on every request, because eligibility is a statement about the
caller.

**One hash per topic, not one key per query.** Each topic is a single Redis
hash whose fields are the parameter combinations. Invalidating is `DEL` on one
key — atomic, no `SCAN`, and no way to miss a combination of filters that was
never enumerated. The cost is that expiry is per topic; `EXPIRE NX` keeps the
window running from the first write so a busy topic still rebuilds.

**Searches are not cached.** A search term is typed once. Caching it would
fill the hash with entries nobody reads twice and evict the lists that every
page load depends on.

**Writes invalidate; the TTL is only a backstop.** Announcement writes through
the API drop the topic themselves. Event writes still happen through Prisma in
the Next.js process and cannot reach this cache, so `POST /api/v1/cache/invalidate`
exists for them to call: the frontend names a topic, and key layout stays in
one place. Retire it when those writes move to the API. `CACHE_TTL_SECONDS`
(300) then covers only what neither path sees — a row changed through the
table browser at `/admin`, or psql.

**A cache outage costs latency and nothing else.** Every failure — no
`REDIS_URL`, a refused connection, a timeout, a value JSON will not take —
falls through to the loader and returns the same answer. An empty `REDIS_URL`
is the same code path, so "off" is a state the tests exercise rather than an
untried one. The client is given a 250 ms timeout and no retries, because a
Redis slower than that is slower than the query it stands in front of.

## 2026-09-20 — Announcement content is sanitized HTML, not plain text

`Announcement.content` moves from a plain string to sanitized HTML, so the
composer can offer formatting (bold, headings, lists, links) instead of a
bare `<textarea>`. No schema migration: the Prisma column was already an
unbounded `String`, and existing plain-text rows remain valid HTML (a plain
string with no tags).

- The editor (`frontend/src/components/ui/rich-text-editor.tsx`) is a Tiptap
  instance wrapped in the portal's own shadcn primitives (`Toggle`, `Button`,
  `Popover`, `Separator`) rather than a themed third-party toolbar or a
  registry component — no such component exists in the shadcn registry as of
  this date (`npx shadcn view editor` 404s).
- `frontend/src/lib/rich-text.ts` and `backend/app/core/rich_text.py` each
  carry the same closed tag/attribute allow-list (`p, br, strong, em, u, s,
  h2, h3, ul, ol, li, blockquote, a[href|target|rel]`) and run it through
  DOMPurify (frontend) or bleach (backend). Both the Zod schema
  (`announcementFormSchema`) and the Pydantic schema (`AnnouncementCreate` /
  `AnnouncementUpdate`) sanitize on the way in, and every render site
  (`announcements-manager.tsx`, `dashboard-feed.tsx`) sanitizes again on the
  way out, so a row written before this allow-list existed, or by a caller
  that bypassed one schema, still renders safely.
- The 2-10,000 character bounds on `content` now apply to the sanitized
  text (tags stripped), not the raw HTML, since formatting overhead has
  nothing to do with "too long". The raw field still carries a generous
  hard ceiling (50,000 characters server-side) as a byte-size backstop.
- Search indexing and one-line table previews strip tags back to plain text
  first (`stripHtmlToText`); nothing searches or truncates raw HTML.

## 2026-09-20 — `DataTable` moves onto shadcn, in place, for all twelve screens

Answers the question the 2026-09-18 grid entry left open — shadcn `Table` +
`DropdownMenu`, not a second hand-rolled CSS pass — and does it once for
every table rather than as a per-screen migration.

- **A pilot was tried first and abandoned.** `/admin/announcements` was
  briefly rebuilt as its own TanStack Table v8 component
  (`frontend/src/components/admin/announcements-table/`), separate from
  `common/data-table.tsx`. Converting each of the other eleven screens the
  same way would have meant rewriting every column/filter definition across
  roughly 6,000 lines in ten files — including the bulk-select checkbox and
  sticky columns on Applications, the RBAC-sensitive Users and Team screens,
  and every screen's exports and dialogs — for no behavioural gain over
  restyling the one component they already share. That pilot folder is
  deleted; nothing references it.
- **The actual change is entirely inside `frontend/src/components/common/data-table.tsx`.**
  `DataTableColumn<T>`, `DataTableFilter<T>`, `DataTableProps<T>`, and the
  `applyTablePipeline`/`nextSortState` search-sort-filter-paginate pipeline in
  `frontend/src/lib/data-table.ts` are unchanged. Only the render layer moved:
  `table`/`thead`/`tr`/`th`/`tbody`/`td` become shadcn's `Table` family; the
  filter popover becomes `Popover` + `Command` (`frontend/src/components/ui/command.tsx`,
  already installed for the recruiter picker); column visibility becomes a
  `DropdownMenu` (new: `frontend/src/components/ui/dropdown-menu.tsx`); rows-per-page
  becomes the existing `Select`; every button in the table's own chrome
  becomes `Button`. Because the props contract didn't change, none of the
  eleven consuming manager files needed an edit — they inherit the new look
  by rebuilding.
- **No new runtime dependency.** `@tanstack/react-table` (added and pinned to
  `8.21.3` for the abandoned pilot, since installing it bare pulls the
  incompatible `9.x` `TableFeatures` API) was removed again once the pipeline
  reuse made it unnecessary. `DropdownMenu` needed no new package either — the
  unified `radix-ui` package already in `package.json` ships it, the same way
  every other primitive in `components/ui` reads it.
- **shadcn's own defaults read this portal's tokens, not a shadcn palette.**
  `bg-muted`, `text-muted-foreground`, and friends resolve through the
  `@theme inline` bridge in `globals.css` onto `--surface-alt`/`--muted` etc.,
  the same tokens `admin.css` already used — so a shadcn `TableRow`'s built-in
  hover state lands on the same colour the hand-rolled one did, in both
  themes, with no per-component override.
- **Every filter gets a search box now, not just ones with more than six
  options.** The old `FilterMenu` added a search input only past a six-option
  threshold, which is why the Company filter (six seeded rows) rendered with
  none. `Command` ships an input and filters its own items, so every filter
  chip across all twelve tables gets one for free.
- **Rows-per-page is a `Select` now, not a native `<select>`.** A native
  select's popup is drawn by the OS and carried its own accent colour (a red
  hover ring on macOS) that didn't match anything else on the page.
- **The header row and toolbar buttons are shadcn's own (smaller) sizes now**,
  not the 50px/15px-600 header and 44-46px buttons the 2026-09-18 entry fixed
  — sort triggers are `Button variant="ghost" size="sm"`, filter/view chips
  are `Button variant="outline" size="sm"`, matching what shadcn's own
  data-table examples ship.
- `admin.css`'s `.dt-*` rules were not deleted. `.dt-header`/`.dt-card`/`.dt-toolbar`/
  `.dt-scroll`/`.dt-table` (sizing, sticky offsets, `tabular-nums`)/`.dt-pagination`/
  `.admin-empty`/`.dt-primary`/`.dt-muted`/`.dt-skeleton` still apply — they are
  layout and cell-content helpers the ten untouched manager files' own `cell`
  renderers still use, not the interactive chrome that moved to shadcn. Some
  of the old interactive-chrome rules (`.dt-filter-button`, `.dt-popover*`,
  `.dt-check`, `.dt-sort`, `.dt-rows-*`, `.dt-page-buttons`) are now dead and
  can be pruned in a follow-up pass; left in place for now since an unused
  CSS rule is not a correctness risk.

## 2026-09-20 — Node moves to 22 everywhere, because the rich-text sanitizer requires it

`isomorphic-dompurify` and its `jsdom` dependency, added by the "Implement
rich text editor for announcements with HTML sanitization" change, each
declare `"engines": { "node": "^22.22.2 || ^24.15.0 || >=26.0.0" }`. Every
image in the repository was still `node:20-alpine` — `frontend/Dockerfile`,
`frontend/Dockerfile.dev`, `database/Dockerfile`, and `node-version: 20` in
`.github/workflows/ci.yml` — which is outside that range entirely. `npm
install` does not hard-fail on an engine mismatch, only warns, so the module
installed anyway and crashed the first time it actually ran: `Failed to load
external module jsdom-<hash>: TypeError: webidl.util.markAsUncloneable is
not a function`, thrown from `frontend/src/lib/rich-text.ts` on module
evaluation. Every announcement write path imports it — saving, deleting, and
`setAnnouncementStatusAction` (publish/withdraw) — so all three failed on
Node 20, in every environment including production, not only in local
Docker. `next build` never caught it because bundling a server action does
not execute it; the crash only fires when jsdom's native bindings actually
load at request time.

All four pins move to `node:22-alpine` / `node-version: 22`, the nearest LTS
line that clears the floor. Not `node:24-alpine`: 22 is a smaller version
jump off the LTS the project already had, and this fix is about clearing the
engine floor, not about picking the newest available runtime. Revisit if a
future dependency needs 24 or later.

## 2026-09-20 — An event's additional questions are authored, not yet answered

The 2026-09-17 events entry listed the per-event question builder as
deliberately not built. This builds the authoring half only — a company's
extra screening questions (a cover letter, a portfolio link, "why us") on
top of the resume every applicant already attaches.

- **`JobProfile.questions Json?`** is the first `Json` column in the schema
  (migration `20260920120458_add_job_profile_questions`, nullable and
  additive, no backfill). Each element is
  `{ id, type: "TEXT" | "MCQ" | "CHECKBOX" | "FILE", question, options? }`;
  `options` only applies to MCQ and Checkbox. A JSON array was chosen over a
  child table because nothing needs to query *into* individual questions —
  the whole list is read and written together, once, by the one form that
  owns it — and a child table would need its own migration for something
  that is still just draft-shaped. Revisit if per-question analytics or
  reordering-with-history is ever asked for.
- **`Prisma.JsonNull`, not a bare `null`.** Prisma cannot tell a SQL `NULL`
  from the JSON literal `null` unless told which one is meant; passing a
  bare `null` for a `Json?` field is a type error for exactly this reason.
  `frontend/src/app/admin/events/actions.ts` writes `Prisma.JsonNull` when
  the office removes every question, so an event that used to carry
  questions and now carries none stores SQL `NULL`, not `[{}]`-shaped noise.
- **No student answer is stored anywhere.** Collecting one needs its own
  column on `Application`, plus apply-flow UI to render the right control
  per question type and validate a required one was answered — deliberately
  separate work, so the schema doesn't grow past what has a consumer yet.
  `backend/app/schemas/job.py` and the FastAPI job router are untouched for
  the same reason: nothing reads `questions` there yet.
- `backend/app/models/db.py` mirrors the column as `JSONB` per the standing
  rule, even though the only writer is the Prisma-direct admin action, so a
  future FastAPI reader does not have to catch the mirror up first.
- The builder (`EventQuestionBuilder`) is plain shadcn — `Select`, `Input`,
  `Button`, `Label` — reusing the same "controlled state, `FormData` on
  submit" pattern the rest of `event-form.tsx` already follows, so it needed
  no new state-management approach. A question missing its text, or an
  MCQ/Checkbox short of two non-empty options, joins the form's existing
  "Still needed: …" hint and blocks Save, the same validation UX every other
  required field on this form already uses — no separate error-styling
  pattern was introduced.

## 2026-09-20 — The event composer widens, and Job Description becomes rich text

Two changes to `/admin/events/add` and `/admin/events/[id]/edit`, on request.

- **`admin-page` gains the `composer-page` class**, the same 1560px widening
  `/admin/announcements/company-event` and `/admin/announcements/general`
  already use, for the same reason: a long single-column form reads better
  with more room than the 1280px every table page wants. No new CSS — the
  rule already existed for exactly this case.
- **`Description` is now `RichTextEditor`, not a plain `Textarea`.** The
  sanitizer the announcement composer already used was generalized rather
  than duplicated: `sanitizeAnnouncementHtml` in `frontend/src/lib/rich-text.ts`
  is renamed `sanitizeRichText` (the allow-list and `stripHtmlToText` were
  already feature-agnostic; only the name was announcement-specific), and
  every caller — `announcement-schema.ts`, `announcements-manager.tsx`,
  `dashboard-feed.tsx`, the test file — moved with it in the same change.
  `job-profile-schema.ts`'s `description` field now sanitizes on the way in
  and checks its length against the stripped text, the same rule
  `Announcement.content` follows. No column migration: `JobProfile.description`
  was already an unbounded `String?`, and an old plain-text row is still
  valid HTML (a plain string with no tags), exactly as the announcement
  migration noted for the same reason.
- **Every render site was found and fixed, not just the editor.** The only
  other place `JobProfile.description` reaches a screen is
  `/company-events/[id]`'s "Opening overview" section, which used to print
  it as an escaped plain string. It now renders sanitized HTML through
  `.rte-content` (dangerouslySetInnerHTML) when `openingOverview` — a
  separate, still-plain-text field — is absent. The admin events list does
  not show `description` anywhere, so nothing else needed a fix.
- `EventQuestionBuilder`'s validation check for an empty description
  (`event-form.tsx`'s `missing` list) moved from `description.trim()` to
  `stripHtmlToText(description)`, because an empty Tiptap document
  serializes to `<p></p>`, which `.trim()` alone would have read as filled in.

## 2026-09-20 — An event can carry attachments, and `JobProfile.attachments` becomes JSON

The event composer's attachment uploader — the other half of the 2026-09-17
"not built" list, alongside the question builder — is now built, on the same
stage-before-save pattern the announcement composer's uploader already uses.

- **`JobProfile.attachments` moved from `String[]` to `Json?`**
  (migration `20260920124455_job_profile_attachments_json`), storing
  `{ fileName, fileUrl, mimeType, sizeBytes }[]` — the same fields
  `AnnouncementAttachment` carries as columns, as an inline array instead of
  a child table, for the same reason `questions` is one: a handful of files
  read and written together by the one form that owns them. The migration
  drops and recreates the column; every row was confirmed empty first
  (`SELECT COUNT(*) FILTER (WHERE array_length(attachments,1) > 0)` returned
  0 of 8), so there was nothing to lose. `backend/app/models/db.py` mirrors
  it as `JSONB`.
- **A narrower type list than an announcement's: `.pdf` and `.png` only, 4 MB
  each, 5 files.** A drive attaches a job description or a poster, not a
  shortlist spreadsheet — `EVENT_ATTACHMENT_EXTENSIONS`/`EVENT_ATTACHMENT_MAX_MB`
  in `backend/app/routers/uploads.py`, mirrored in
  `frontend/src/lib/job-profile-schema.ts`. The new
  `POST /uploads/admin/event-attachment` endpoint calls the same
  `validate_attachment()` the announcement endpoint does (magic-byte checked,
  not just the extension) and then narrows the result to that pair, rather
  than forking the validator.
- **`GET /uploads/files/{path}` gained a matching visibility rule for
  `event_docs/`**: readable once the owning `JobProfile.status` is not
  `DRAFT`, private while it still is — the same rule an announcement
  attachment follows, checked with a cast-to-text `LIKE` over the JSON
  column since there is no child table to join here.
- **The dropzone (`EventAttachmentUploader`) is plain shadcn/Tailwind**, not
  a port of the announcement composer's hand-rolled `.dropzone`/
  `.composer-attachments` CSS — a dashed-border div, `Label`, and native
  drag/drop handlers, matching the rest of this session's shadcn work rather
  than the composer's older, not-yet-migrated styling.
- Not built: an attachment's own permission story beyond "visible once
  published" — there is no separate grant for who may see a drive's
  attachments versus the drive itself, matching how an announcement's
  attachments already work.

## 2026-09-20 — Optional eligibility gains a 10th/12th percentage floor, and CGPA moves into it

Two decisions the office made when asked, before this was built: minimum CGPA
moves from its own always-visible field into "Optional Eligibility Criteria"
(relabelled "Graduation GPA" there) rather than gaining a second, separate
field; and the new 10th/12th percentage minimums are real eligibility
criteria, not informational-only text fields.

- **New nullable `JobProfile.min10Percent`/`min12Percent`**
  (migration `20260920153218_job_profile_percent_minimums`), following
  `minCGPA`'s own convention: unset means no floor, not zero — a `Float?`
  rather than reusing `minCGPA`'s `@default(0)`, since 0 is itself a
  meaningful minimum here (a job could conceivably ask for "any 10th
  percentage, but not literally negative"), and null is the only
  unambiguous "not asked" value.
- **Wired into both eligibility engines, not just stored.** `evaluate_eligibility`
  (Python) and `evaluateEligibility` (TypeScript) each gained two criteria and
  now thread `min10Percent`/`min12Percent` through every call site that
  builds a job's criteria — `backend/app/routers/{applications,jobs}.py`,
  `backend/app/services/student_flags.py`, `frontend/src/app/dashboard/page.tsx`,
  `frontend/src/app/company-events/actions.ts`, and
  `frontend/src/app/company-events/[id]/page.tsx` — the same "every criterion
  is a named argument" discipline the existing ones already follow, so a call
  site that forgets one gets a compiler or `KeyError` failure instead of a
  silently-skipped check. `toEligibilityProfile`/`to_eligibility_profile`
  gained `class10Percent`/`class12Percent` from the `User` row, which already
  carried both columns for profile-completion percentage and needed no new
  fetch.
- **An unset floor passes everyone; a set floor fails a student whose profile
  cannot answer it** — the same rule an unrestricted branch/degree/gender list
  already follows, applied here via a small `meetsPercentFloor`/
  `_meets_percent_floor` helper in each engine rather than inlining the
  three-way null check at each of the two new criteria.
- **A live regression from the attachments change earlier in this session was
  caught and fixed while touching this file's neighbour.**
  `backend/app/schemas/job.py`'s `JobBase.attachments` was still typed
  `list[str]`, unchanged since the `String[]` days, so `GET /api/v1/jobs`
  would have failed Pydantic validation against every row the moment
  `JobProfile.attachments` became a JSON array of objects. Added a
  `JobAttachment` model and moved `attachments` out of the plain
  `empty_when_null` list-of-strings validator into its own call. Confirmed
  fixed by validating `JobResponse` against every real row in the dev
  database, not just the mocked test fixtures.
- **`event-form.tsx`'s "Optional Eligibility Criteria" block now resets CGPA
  and both percentages to "no minimum" when the toggle is switched off**,
  matching how `allowedGenders`/`maxBans` already behaved — before this,
  CGPA sat outside the toggle entirely and was never reset, which is exactly
  why moving it inside without also gating its submitted value would have
  been a silent behaviour change (a value typed once would keep applying
  after the section was collapsed).
- Not changed: `allowedGenders`'s control stays the existing multi-select
  `ToggleGroup`, not a single dropdown, despite the reference image showing
  one. Converting it would have dropped the ability to allow two genders
  while excluding a third, which nothing asked for.

## 2026-09-21 — The real roster replaces `students_data.json`, and the demo dataset attaches to it directly

The placement cell supplied the actual 668-row student roster (roll number,
name, branch, degree, graduation year, and a shared default password) and it
now lives at `database/seed-data/students.json` — the path the *synthetic*
demo roster used to occupy before this entry. Two scripts needed to change
because of where that file now lives and what it now means:

- **`database/scripts/import-students.ts`** reads the roster from
  `database/seed-data/students.json` instead of a root `students_data.json`
  (removed), and from the roster's own column names (`Institute Email ID`,
  `Full Name`, `Roll Number`, `Graduation Year`, `Branch`, `Degree`,
  `Password`) instead of the old lowercase/underscore ones. It now also sets
  `passwordHash` from the roster's `Password` column on every run, the same
  as `branch`/`degree`/`batch`/`personalEmail` already were — this is
  deliberately an overwrite, not a fill-the-gap, because the production
  workflow this exists for is: the placement cell rotates a student's
  password by editing their row in the roster, reseeds, and emails them the
  new password from the same row. A "only if empty" rule would silently keep
  the old password live after that email went out. Rows that share a
  password (every row does today, in the local development dataset) still
  only pay bcrypt's hashing cost once, since the hash is cached by plaintext
  value within a single run. One consequence worth stating plainly: an
  individual password set through `/admin/users` (the documented path for
  recovering one student's forgotten password) is overwritten the next time
  `db:import-students` runs, if that student's roster row was not updated to
  match. Bulk rotation belongs in the roster; one-off recovery between
  rotations does not survive the next import.
- **`database/scripts/seed-demo-data.ts`** no longer creates a small set of
  synthetic `demo-user-*` accounts for its dummy companies, job profiles,
  applications, offers, feedback, and NOC requests to point at. It looks up
  real accounts by roll number instead (`loadStudentsByRollNumber`, which
  fails loudly if `db:import-students` has not run yet) and every
  `studentSlug` field across `database/seed-data/{applications,offers,
  feedback,noc-requests}.json` and `personal-activity.json` is now
  `studentRollNumber`. `database/seed-data/students.json` is no longer one of
  the zip's entries — it is real data, not demo data, and
  `pack-demo-data.ts` now excludes it by name so it never lands in
  `seed-data.zip`.

Chosen over keeping the two rosters (real accounts + a small synthetic one for
demo activity) separate, which was the only alternative considered: it stays
truer to the stated goal of a portal that already looks populated for actual
students the moment `make seed` finishes, at the cost of `make db-remove-demo`
no longer being a full undo of `make db-seed-demo` — the applications, offers,
feedback, and NOC rows it created are removed as before (they keep their
`demo-` ids), but the real accounts they were attached to, and any profile
fields `db:import-students` filled on them, are not, because removing a real
student account was never on the table.

`JobRecord.batch` also changed from `currentYear + batchOffset` to a literal
graduating year (2027 or 2028 in the current dataset). The old relative-offset
scheme kept the synthetic roster from going stale as real time passed, but a
job now has to match the fixed graduating year of the real students it
targets, which does not move just because the calendar did. Registration
deadlines and every other date in the dataset are still offsets from the seed
run, so they stay evergreen.

## 2026-09-21 — A fifth role, FACULTY: read-only NOC, placement records, and the overview; ranked between STUDENT and PLACEMENT_VOLUNTEER

Requested directly: faculty need to see NOC requests (including the signed
PDF) and placement records, and the placement dashboard overview, without any
ability to change them, create them, or apply to a drive — ranked below
`PLACEMENT_VOLUNTEER` and above `STUDENT`.

- **`Role` gains `FACULTY`** in `database/prisma/schema.prisma` (migration
  `20260921095322_add_faculty_role`, an `ALTER TYPE ... ADD VALUE`, so it is
  additive and non-destructive) and its hand-maintained mirror in
  `backend/app/models/db.py`.
- **Its default permission set is exactly three keys** —
  `analytics.view`, `noc.view`, `placement_records.view` — added as
  `FACULTY_DEFAULTS`/`_FACULTY_DEFAULTS` in `frontend/src/lib/permissions.ts`
  and `backend/app/core/security.py`, the two files that already had to stay
  identical for every other role. No create/update/delete/approve permission
  is granted, and `applications.apply` is not only withheld but structurally
  unreachable: `require_student` in the backend gates applying on the literal
  `STUDENT` role, not on a permission key, so no combination of custom
  permissions could ever let a FACULTY account apply.
- **Ranked by `ROLE_METADATA[...].tier`**, a display/sort-only field (see the
  2026-09-17-era permission catalog) — `STUDENT` 1, `FACULTY` 2,
  `PLACEMENT_VOLUNTEER` 3, `PLACEMENT_TEAM` 4, `SUPER_ADMIN` 5. Tier has never
  driven authorization; that's entirely `ROLE_DEFAULT_PERMISSIONS` and
  `ROUTE_PERMISSIONS`, both of which this entry's permission set already
  determines.
- **Deliberately excluded from `isElevatedRole`/`is_elevated_role`.** That
  function is a broader shortcut than a permission check — "trust this role
  for anything not explicitly permission-gated" — used inside
  `hasAnyAdminPermission`'s fallback, `canAccessAdminRoute`'s fallback for a
  path with no `ROUTE_PERMISSIONS` entry, and (backend)
  `get_current_user`'s domain/role gate. Including FACULTY there would have
  been the one-line fix for every symptom below, at the cost of granting
  faculty implicit access to any future admin route nobody remembered to add
  to `ROUTE_PERMISSIONS` — the opposite of "read-only, exactly these three
  screens." Both functions carry a comment now explaining the omission is
  intentional, not a gap. Faculty still reach the admin portal correctly:
  `hasAnyAdminPermission`'s permission-based branch already treats any
  non-student-scoped permission as administrative, and `noc.view`/
  `placement_records.view`/`analytics.view` are not in
  `STUDENT_SCOPED_PERMISSIONS`.
- **Three call sites had to stop using `isElevatedRole` for the post-login
  landing page**, because that decision — `/admin/dashboard` vs `/dashboard`
  — was the one place in the app that read the role literal directly instead
  of asking a permission question, and a non-elevated FACULTY account would
  have landed on the empty student dashboard after every sign-in.
  `frontend/src/app/login/page.tsx`, `frontend/src/app/register/page.tsx`,
  and `frontend/src/app/account/password/page.tsx` now call
  `hasAnyAdminPermission(session.user)`, the function the rest of the app
  already uses for this exact question (`proxy.ts`, `admin-session.ts`).
- **The NOC PDF has its own gate, separate from the JSON list/detail
  endpoints, and it was missing `noc.view`.** `backend/app/routers/uploads.py`'s
  `get_uploaded_file` — the generic local-file server also behind resumes,
  identity documents, and announcement/event attachments — decided
  `is_admin` from `is_elevated_role`, `is_admin_email`, `students.view`, or
  `applications.view`, none of which a view-only FACULTY account holds. Fixed
  narrowly, not by broadening `is_admin` (which would have hit every file
  type this endpoint serves): inside the existing `noc_docs/`-prefixed
  branch, a caller holding `noc.view` is now authorized for that document
  without the per-row ownership query, the same read access the admin NOC
  list/detail endpoints already give them via `require_permission(PERM_NOC_VIEW)`.
  Covered by a new test in `backend/tests/test_storage.py`.
- **`/admin/placement-records` had no read-only UI mode; this exposed that as
  a real, pre-existing gap, not just a FACULTY-shaped one.** The Add/Edit/Delete
  controls in `placement-records-manager.tsx` rendered unconditionally for
  anyone who could reach the page at all — server actions were correctly
  permission-gated, but `PLACEMENT_VOLUNTEER` (which has only
  `placement_records.view`, same as FACULTY) already saw an enabled "Add
  record" button and per-row Edit/Delete icons that would 403 on submission.
  `placement-records/page.tsx` now computes `canCreate`/`canUpdate`/`canDelete`
  from the three separate permission keys and passes them down; the manager
  hides each control it lacks the grant for, and omits the Actions column
  entirely rather than rendering it empty when neither grant is held — the
  same pattern `noc-requests-manager.tsx`'s `canDecide` already established
  for Approve/Reject.
- **`/admin/users`'s and `/admin/settings`'s role-count tiles silently
  miscounted, or omitted, FACULTY.** `users-manager.tsx` computed its stats
  client-side with an `else students++` catch-all that had been correct only
  because the four roles before this one were all explicitly branched — a
  FACULTY account would have been counted as a student. Fixed by adding an
  explicit branch and a `faculty` count, folded into the existing "Placement
  Cell" tile (renamed "Placement Cell & Faculty") alongside team/volunteer
  counts, since `FACULTY` and `PLACEMENT_VOLUNTEER` are the same shape of
  role — read access, cannot change it. `admin/settings/page.tsx`'s
  server-side counts got the same `FACULTY` query and the same tile treatment
  in `settings-manager.tsx`, for the same reason.
- Not changed: the self-demotion guards in `admin/users/actions.ts` and
  `backend/app/routers/users.py` (`update_user_role`) only special-case
  demoting to `STUDENT` or `PLACEMENT_VOLUNTEER` today — they already didn't
  cover self-demotion to `PLACEMENT_TEAM` either, so leaving `FACULTY` out is
  consistent with that existing scope rather than a new gap.

## 2026-09-21 — NOC requests gain an offer source, an off-campus proof document, an independent verification mark, and a no-review path; FACULTY narrows to APPROVED only

Four requests bundled together, plus a consequence of the FACULTY role from
the entry above. Two decisions were confirmed directly rather than assumed,
because both change workflow semantics in a way that's hard to walk back
once students start relying on it:

- **A "no NOC required" submission is auto-recorded, never queued for
  review.** `NocRequest.nocRequired: Boolean @default(true)` — when false,
  `create_noc` sets `status` straight to `APPROVED` instead of `PENDING`, so
  the row never appears in anyone's decision queue and no PENDING→APPROVED
  transition is logged for something nobody decided. The alternative
  (still landing in PENDING so the placement cell acknowledges it) was
  explicitly turned down: it would add busywork for entries that by
  definition need no decision. Modeled as a boolean, not a fourth
  `NocStatus` value — the exhaustiveness risk of a new enum member across
  every `status === "PENDING"`-shaped conditional in both frontend and
  backend (cancel eligibility, row-action gating, the metrics tiles, the
  status filter) was worse than one extra column. The UI derives what it
  shows from this flag, not from `status`: `displayStatus()` in
  `noc-requests-manager.tsx` and the equivalent inline check in
  `forms-view.tsx` render "Not required" instead of "Approved" whenever
  `nocRequired` is false, so nobody reads an unreviewed row as a real
  approval. `get_noc_metrics` counts these rows separately (`notRequired`)
  from `approved`, for the same reason.
- **The "verified by placement team" toggle never gates Approve/Reject.**
  `NocRequest.verifiedByPlacementTeam: Boolean @default(false)`, set via the
  new `PATCH /noc/admin/{id}/verify` (`require_permission(PERM_NOC_APPROVE)`,
  the same grant `canDecide` already checks — no new permission key). It is
  purely a record that someone on the placement team looked at the student's
  off-campus proof document; approving or rejecting the request never checks
  it. The alternative (blocking Approve until verified) was explicitly
  turned down as an unrequested hard workflow dependency.
- **Off-campus offers carry their own proof document, submitted by the
  student, separate from the placement cell's signed certificate.** New
  `NocSource` enum (`ON_CAMPUS` | `OFF_CAMPUS`, defaulting `ON_CAMPUS` so
  every pre-existing row reads the way it always implicitly was) and
  `NocRequest.offCampusProofUrl`, staged before the request exists via the
  new student-facing `POST /uploads/noc-offcampus-proof` (the same
  stage-before-save pattern the announcement and event composers already
  use), then attached when `POST /noc` is called with the returned URL.
  `NocCreate.validate_offcampus_proof` rejects an `OFF_CAMPUS` submission
  with no proof URL — the whole point was giving the placement cell
  something to confirm the offer is real before proceeding. Uses
  `validate_attachment`/`upload_document` (pdf/png/jpg/jpeg/doc/docx), not
  the PDF-only `validate_pdf`/`upload_pdf` the signed certificate uses,
  since an offer letter is as likely to be a scanned image as a PDF.
  Read access for both the JSON fields and the file bytes is symmetric with
  the existing signed-certificate path: `frontend/src/app/api/
  noc-offcampus-proof/[id]/route.ts` mirrors `noc-documents/[id]/route.ts`,
  and `backend/app/routers/uploads.py`'s `get_uploaded_file` gained a second
  `noc_offcampus_proof/`-prefixed branch alongside `noc_docs/`, both
  resolved by the same `has_permission(PERM_NOC_VIEW)`-or-ownership check.
- **FACULTY (added in the entry above) only ever sees APPROVED NOC
  requests.** `list_admin_nocs` force-filters to `NocStatus.APPROVED` for
  that role regardless of the `status_filter` query param — not merely
  defaulted, so a FACULTY caller cannot ask for PENDING/REJECTED explicitly
  either. `get_admin_noc_detail` 404s (not 403s) on a non-approved row for
  the same role, so a pending or rejected request cannot be told apart from
  one that doesn't exist. `get_noc_metrics` suppresses the pending/rejected
  counts for FACULTY for the identical leak reason — an admin dashboard
  tile reading "Pending Review: 3" for requests the role can't open would
  itself be a disclosure. A not-required row is stored `APPROVED` (see
  above), so FACULTY does see those too — they're a settled record with
  nothing left to decide, the same category as a real approval from this
  role's point of view.
- Verified live via direct API calls against the running dev stack with
  hand-signed JWTs for a real student, a FACULTY account, an unrelated
  student, and an admin: the off-campus-without-proof submission 422s, a
  `nocRequired: false` submission lands at `APPROVED` immediately, the
  verify toggle flips independently of a still-`PENDING` status, FACULTY's
  list/metrics never surface a non-approved row, a FACULTY detail fetch on
  a `PENDING` row 404s, an unrelated student is refused the proof PDF's
  bytes while the owning student and a `noc.view` holder are not.

## 2026-09-22 — CGPA and backlogs are no longer student-editable; `students.update` gets its first route

A security review found that a student could `PATCH /profile` their own
`cgpa` and `backlogs` to any value inside the schema's numeric range, with
no cross-check against an official record. Both fields are load-bearing:
`backend/app/services/eligibility.py` / `frontend/src/lib/eligibility.ts`
evaluate them directly against a drive's `minCGPA`/`maxBacklogs`, and the
admin applications screen shows them to recruiters as the candidate's
record. A student with a 6.2 CGPA and 2 backlogs could self-report 9.5 and
0, pass eligibility for a drive that should have rejected them, and have
the fabricated number displayed to the recruiter reviewing the application.

- **`cgpa` and `backlogs` are removed from `StudentProfileUpdate`
  (`backend/app/schemas/student.py`) and `studentProfileSchema`
  (`frontend/src/lib/profile-schema.ts`)**, the same way roster fields
  (name, roll number, branch, degree, batch) were already excluded — by
  omission from the schema that is the actual write boundary, not by a
  runtime check. `frontend/src/components/profile/profile-view.tsx` locks
  both inputs the same way it already locked the roster fields
  (`ACADEMIC_LOCKED_FIELDS`, folded into the existing `LOCKED_FIELDS` set),
  with its own tooltip pointing the student at the placement office rather
  than implying a roster import owns the value.
- **A new schema, `StudentAcademicCorrection`, is the only way to write
  either field now**, bound to a new route,
  `PATCH /students/admin/{id}/academic`
  (`backend/app/routers/students.py`), guarded by `students.update` — a
  permission that has existed in the 49-entry catalog since the RBAC
  redesign (2026-09-17) with exactly this description ("Update roster
  fields, backlogs, and placement bans") but had no route or admin screen
  behind it until now. Both fields are independently optional on the
  correction schema, so a placement-cell member can fix just the CGPA or
  just the backlog count without having to know the other value.
- **The admin student detail page
  (`frontend/src/components/admin/student-profile-detail.tsx`) gained a
  "Correct CGPA / backlogs" action**, shown only when the viewer holds
  `students.update` (checked server-side in
  `frontend/src/app/admin/students/[id]/page.tsx` via `hasPermission`, the
  same pattern `/admin/placement-records` already uses to gate its
  create/update/delete buttons). The action is a `PortalDialog` form
  (`student-academic-correction-dialog.tsx`) that posts through a new
  `"use server"` action, `updateStudentAcademicAction`
  (`frontend/src/app/admin/students/actions.ts`), which re-validates with
  `studentAcademicCorrectionSchema` before calling the backend — the
  browser is not trusted any more here than it is anywhere else in the
  portal.
- **No Prisma fallback was added for the new write.** Every other
  student-directory screen still reads through Prisma directly pending the
  broader FastAPI migration, but this is a new route with no legacy
  behavior to preserve, and adding a second write path for the exact value
  this decision restricts would have undercut the fix.

## 2026-09-22 — Registration requires an email-OTP before anything is written to `User`

A security review found that `/register`'s "claim an existing account"
path — added in the 2026-09-17 entry below, once Google sign-in stopped
proving mailbox ownership — let anyone who could type an institute address
set its password. Both 2026-09-17 entries said as much explicitly: *"With
no verified provider and no verification mail, whoever registers an unused
institute address owns it... A verification link at registration is still
the single change that would fix this."* Institute addresses are commonly
roll-number-shaped and therefore guessable, so this was a real
account-takeover path against any student who had not yet registered,
reaching their applications, resumes, NOC requests, and profile PII. This
entry is that change.

- **Registration is now two steps.** `requestRegistrationOtpAction`
  (`frontend/src/app/register/actions.ts`) validates the form, runs the
  same eligibility checks the old single-step `registerAction` did
  (domain, not an `ADMIN_EMAILS` address, not already claimed by an
  active password, not a `TeamMember` row), hashes the password, and
  stages `{ name, passwordHash }` — **not** the plaintext password — for
  the address. `verifyRegistrationOtpAction` only writes to `User`, by
  claim or by create, once the caller types back the code that was
  emailed to that exact address. `RegisterForm`
  (`frontend/src/app/register/register-form.tsx`) is the client component
  that drives the two steps; `register/page.tsx` is back to a thin server
  wrapper.
- **The dormant `VerificationToken` table holds the pending state**, not a
  new table. It was scaffolded for Auth.js's email provider and has been
  unwritten since Google sign-in was removed (2026-09-17); it is exactly
  shaped for this — `identifier` the email, `token` now `sha256(code)` so
  the code itself is never at rest, `expires` a 10-minute TTL. It gained
  one column, `payload Json?`, for the staged `{ name, passwordHash }` —
  `database/prisma/migrations/20260922175701_add_verification_token_payload`.
  A request deletes any row already pending for that address before
  writing a fresh one, so a resend invalidates whatever code came before
  it, and a successful or failed-out verify deletes the row too — a code
  is single-use on every exit path. `frontend/src/lib/registration-otp.ts`
  owns all of this and is the only code that reads or writes the table.
- **Two independent throttles, not one.** Requesting a code and guessing
  one are different abuse shapes — one spends a victim's inbox (and
  Resend's bill), the other spends the 6-digit space — so each gets its
  own limit and lockout, both a generalization of the existing
  `login-throttle.ts` pulled out into `frontend/src/lib/rate-limit.ts`
  (`createThrottle`) so the two throttles and the pre-existing login one
  share the sliding-window/lockout logic rather than three copies of it.
  `login-throttle.ts`'s own exported names and behavior are unchanged —
  it is now a five-line instantiation. Same accepted caveat as before:
  in-process, resets on deploy, not shared across replicas.
- **The email itself is sent by the backend, authorized by a new
  purpose-scoped token, not a shared static secret.** The frontend already
  owns `User`/`VerificationToken` via Prisma and generates the code, but
  the only real mailer in the system is `send_notification_email`
  (`backend/app/services/email.py`, Resend). Rather than duplicating a
  second Resend integration into the frontend, `registration-otp.ts` mints
  a two-minute HS256 JWT — `{ purpose: "register-otp-email", email, code
  }`, signed with the same `AUTH_SECRET` a real session JWT uses — and a
  new endpoint, `POST /auth/internal/send-registration-otp`
  (`backend/app/routers/auth.py`), verifies it and relays the send.
  `require_internal_purpose_token`/`_decode_internal_purpose_token`
  (`backend/app/core/security.py`) are what make this safe to sign with
  the same secret as a session: the `purpose` claim means neither token
  is ever valid as the other, so a lifted session cannot be replayed
  against this endpoint and this token is useless anywhere a session is
  expected. This endpoint is unreachable by a browser — nothing gives a
  browser `AUTH_SECRET` to sign with — so it is not the open mail relay it
  would be if it trusted its caller on request shape alone.
- **`is_email_delivery_configured()` (`backend/app/services/email.py`) is
  a new, small public wrapper around the existing placeholder-key check**,
  so the OTP endpoint can tell a genuinely unconfigured mailer apart from
  a real send it should attempt. When Resend is not configured — every
  local and demo environment today, since `RESEND_API_KEY` ships empty —
  the endpoint logs the code at `WARNING` instead of silently discarding
  it the way `send_notification_email` already does for every other
  email. Without this, registration would have been unusable outside a
  deployment with a real Resend key.
- **`User.emailVerified`, an Auth.js-standard column that nothing has
  ever written since the adapter was removed, is now stamped** on a
  successful claim or create. Nothing reads it yet; it is there for
  whatever needs "was this address ever OTP-verified" next, such as the
  forgot-password flow both 2026-09-17 entries still call outstanding.
- **Verified live** against the running dev stack (containers rebuilt to
  pick up the change): registering a fresh address stages the hash and
  emails nothing to `User` — confirmed with a direct query between the two
  steps — logs the code (`RESEND_API_KEY` is unset locally), rejects a
  wrong code with the row still intact, and accepts the right one, at
  which point the row appears with `emailVerified` set, the
  `VerificationToken` row is gone, and the session signs in and lands on
  `/dashboard`.

## 2026-09-22 — Three unthrottled password checks get a shared, Redis-backed brake

A security review found two gaps the portal's own login throttle
(`frontend/src/lib/login-throttle.ts`) had never covered. First, the
`/admin` table-browser login (`backend/app/admin/auth.py`) and the
identity-document unlock challenge (`backend/app/routers/profile.py`'s
three `*-doc/unlock` routes) had no attempt limit at all — a timing-safe
comparison stops a response from leaking anything, but nothing stopped
unlimited guessing. Second, the login throttle that did exist was an
in-process `Map`: correct for one container, but silently stopped
coordinating the moment the frontend ran as more than one replica, since
each would keep its own count of the same address's failures.

- **`backend/app/core/rate_limit.py` is a new module**, a `Throttle` class
  shaped like `frontend/src/lib/rate-limit.ts`'s `createThrottle`: `name`
  namespaces a throttle's keys, `is_locked_out`/`record_attempt`/`clear`
  are its whole surface, and it fails open on any Redis error — the
  opposite direction from `app.core.cache`, and deliberately so: a cache
  miss falls through to a slower, still-correct answer, but a throttle has
  no equivalent path when it cannot be read, and refusing a request because
  Redis is down would turn one incident into two. It keeps its own client
  rather than sharing `cache.py`'s, because the two fail toward opposite
  defaults and mixing them would make a shared failure path a lie for one
  of them.
- **The `/admin` login is now five attempts per source address, then a
  15-minute lock** — tighter than the portal's own eight, because this
  password is not one person's, so only whoever locks themselves out pays
  for it. A locked-out attempt returns `False` exactly like a wrong
  password: sqladmin's own failure flash is the only thing either produces,
  so a locked address never learns that from the response, the same
  reasoning `login-throttle.ts` already applied to `authorize()`.
- **Each identity document's unlock challenge is now eight wrong numbers
  per (student, document type), then a 15-minute lock.** Keyed per document
  type so a wrong Aadhaar guess does not also lock out a correct PAN in the
  same sitting; keyed per student because the caller is already
  authenticated (`require_student`), so there is an identity to throttle by
  rather than only a source address.
- **`frontend/src/lib/rate-limit.ts` moved from an in-process `Map` to the
  same Redis the backend's read-through cache already uses**, wired to the
  frontend for the first time (`REDIS_URL: redis://cache:6379/0` added to
  the frontend service in `docker-compose.yml`, matching the backend's own
  entry; `.env.example`'s comment above it updated to say both services
  read it now, not only the backend). `login-throttle.ts` is now a five-line
  instantiation, and `registration-otp.ts`'s two throttles (added in the
  entry above) moved to the same backing store in the same change, since
  they shared the old in-process implementation and would otherwise have
  kept its single-replica limitation on their own.
- **`createThrottle` takes an optional, injectable `redis` client**
  (`RedisLike`, the narrow slice of the `ioredis` surface it actually
  calls) rather than always reaching for the shared production client.
  Omitting it resolves the real one, but only through a dynamic `import()`
  inside each method — never a static import at the top of the file. A
  static import of `redis-client.ts` (which is marked `server-only` and
  connects to `ioredis` eagerly) would execute the moment anything imports
  `rate-limit.ts` at all, including `rate-limit.test.ts`, and the real
  `server-only` package throws unconditionally outside Next.js's bundler —
  it has no way to know a plain `node:test` run isn't a browser bundle. The
  dynamic import is only reached when a caller omits `redis` entirely;
  `rate-limit.test.ts` always supplies its own in-memory fake, so it never
  touches Redis, `ioredis`, or `server-only` and needs no Redis to run.
  `login-throttle.test.ts` is retired for the same reason it can no longer
  exist as written: its assertions depended on passing an explicit `now`
  to a synchronous, in-process counter, and there is no equivalent for a
  wall-clock, async, Redis-backed one. The algorithm it exercised is the
  same `createThrottle` `rate-limit.test.ts` now covers directly, with an
  in-memory fake's own fake clock standing in for real Redis TTLs.
- **`server-only` became a real dependency** (`frontend/package.json`)
  rather than the implicit one it always was. Every file that already
  imported it — `db.ts`, `admin-session.ts`, and others — worked only
  because Next.js's bundler special-cases the string `"server-only"`
  regardless of whether the package resolves; a plain Node `require` never
  had that leniency, it simply never had to make the call before, since no
  test file transitively imported one of those modules until this change.
- **Verified live** against the rebuilt dev stack: five wrong `/admin`
  passwords from one address lock it out (a sixth, correct, attempt still
  fails while locked), `redis-cli` shows the corresponding
  `tnp:throttle:db-admin-login:*` keys with TTLs, and a locked-out frontend
  login address is rejected the same way across requests regardless of
  which login attempt is checked against — confirmed by reading the
  `tnp:throttle:login:*` keys directly out of the shared `cache` Redis
  rather than only by observing one process's behavior.
