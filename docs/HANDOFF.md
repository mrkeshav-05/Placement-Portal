# Team Handoff

This file carries short-lived working context between teammates and agents. Canonical architecture belongs in `PROJECT_CONTEXT.md`; durable decisions belong in `DECISIONS.md`.

## Current state

- Active objective: finish moving data access from Prisma-in-Next.js to FastAPI endpoints
- Active owner: unassigned
- Branch: main working tree contains the service split, containerization, and the auth rework
- Last verified (2026-09-18, Add Company pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 122 frontend unit tests, and 148 backend pytest tests in the running `backend` container.
- Last verified (2026-09-17, events pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 119 frontend unit tests, and 148 backend pytest tests in the running `backend` container.
- Last verified (2026-09-17, shared admin data table pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 104 frontend unit tests, and `docker compose up -d --build frontend` with all containers healthy. The 115 backend pytest tests were last run in the announcements pass; this pass changed no backend file.
- Not yet exercised in a browser: every signed-in journey, including the new dashboard, `/admin/placement-records`, and the announcement composer. Nobody has a known admin password on this machine — `placements@iiitl.ac.in` has a hash set by the repository owner — so the screens were verified through the production build, the unit and pytest suites, and SQL against the seeded development database rather than by clicking. The four defect fixes below are covered by unit tests and, for the application export, by running its SQL against the development database; nobody has clicked Export CSV or approved a NOC in the browser.
- External blocker: resume/document storage provider has not been selected

## Add Company page, 2026-09-18

`DECISIONS.md` carries the reasoning under today's date.

1. **Three routes, one form.** `/admin/companies/add` and `/admin/companies/[id]/edit` share `frontend/src/components/admin/company-form.tsx`; the list's modal is gone and its edit action is a link. The sidebar group is now *All companies*, *Add company*, *View registrations*.
2. **Three new nullable columns on `Company`**: `category`, `placementSession`, `turnover`. Migration `20260918000000_company_profile_fields`, mirrored in `backend/app/models/db.py` and `backend/app/schemas/company.py`.
3. **Category is Dream or First Round**, enforced by `companyFormSchema`. Nothing reads `Company.category` yet — eligibility does not treat a dream-round company differently, it only records that it is one.
4. **Website and logo dropped from the form on request.** `saveCompany` omits both from its write payload, so existing values survive an edit, but no screen can set them any more and a new company therefore has no logo for students. Restoring an editor for them is the first item on the companies row in `FEATURE_STATUS.md`.
5. **Company info is required by the form**, while `description` stays nullable for older rows.

**Exercised in a browser end to end.** Created a company through the form with a category and session, confirmed the row in SQL, opened the edit route against it and saw every field hydrate, then deleted the row. The list shows the new Category and Session columns with filters. Not clicked: the list's delete button (the action was only re-gated, not rewritten) and the screens under an account that lacks `companies.create`, which is covered by unit tests instead.

**If a save fails with `Unknown argument`, restart the dev server.** A running `next dev` holds the Prisma client it started with, so a schema change needs `npm run db:generate` *and* a restart. Same for the `migrate` container, which bakes `database/` into its image and needs `docker compose up -d --build migrate` to see a new migration folder.

## Job profiles become Events, 2026-09-17

`DECISIONS.md` carries the reasoning under today's date.

1. **Three routes replace the modal.** `/admin/events` lists, `/admin/events/add` composes, `/admin/events/[id]/edit` edits, all through the one `frontend/src/components/admin/event-form.tsx`. `/admin/job-profiles` is a `permanentRedirect` and stays in `ROUTE_PERMISSIONS`. The table and the `jobs.*` permission family keep their names; only the screens moved.
2. **The write actions now gate on `jobs.create`/`jobs.update` and, for an `ACTIVE` status, `jobs.publish`.** They previously asked only for an admin session.
3. **Five new columns on `JobProfile`**: `placementYear` (required, backfilled from `batch`), `cap`, `companyBond`, `duration`, and `redirectUrl`. Migration `20260917220000_event_form_fields`, mirrored in `backend/app/models/db.py` and `backend/app/schemas/job.py`, and seeded.
4. **Category is the closed list Tech/NonTech/Management/Marketing.** "Core" is refused by `jobProfileFormSchema`, not merely absent from the buttons. Rows seeded with other strings still list; editing one forces a choice.
5. **Degrees and branches come from the roster** through `frontend/src/lib/event-options.ts`. An event being edited keeps values the roster no longer explains, grouped under *Other*.

Deferred, and present in the reference design: the per-event **question builder**, the **attachment uploader** (`JobProfile.attachments` exists and nothing writes it), and a **point of contact** (the `Coordinator` table exists and nothing writes it) — the user asked for the POC to be left out of this pass. None of the three is rendered, because a control that stores nothing would be describing persistence the portal does not have. Questions in particular need answer storage on `Application` before the UI is worth building.

**Exercised in a browser as far as one create.** All three routes were loaded against the seeded development database while signed in as a super admin: the list renders with its filters, the add form saved one event with every new field populated (verified in SQL, then deleted), and the edit route hydrates a seeded row including the company, batch, deadline, and the four selected branches. Not clicked: publishing to `ACTIVE` from the form, deleting from the list, and the screens under a non-super-admin account, so the `jobs.publish`/`jobs.delete` gates are covered by unit tests only.

**The demo seed still writes legacy categories.** `database/seed-data/job-profiles.json` carries `Software`, `Hardware`, `Networking`, `Infrastructure`, and `Design`, none of which are among the four the form offers, so every seeded event opens its editor with no category selected. Mapping them onto Tech/NonTech means editing that file and running `npm run db:pack:demo` to rebuild the archive the seeder actually reads; it was left alone in this pass.

## One admin data table, 2026-09-17

`DECISIONS.md` carries the reasoning under today's date.

All eleven admin lists — companies, events, students, applications, placement records, announcements, feedbacks, NOC requests, interview experiences, users, and team — now render through `frontend/src/components/common/data-table.tsx`. Each screen supplies columns, a search accessor, and filters; nothing about a page lives in the component. The pipeline is `frontend/src/lib/data-table.ts` and is covered by twelve tests in `frontend/src/lib/data-table.test.ts`.

- The old `.admin-row` CSS grid, `.admin-row-head`, and `.user-row-grid` rules are deleted; `.admin-toolbar` stays because the student interview-experiences view still uses it.
- Server actions, modals, permission gating, the applications CSV export, bulk stage changes, and the team reorder arrows were carried over unchanged. The export now narrows on a filter only when exactly one option is selected, because the endpoint takes one value per filter and a file that disagrees with the screen is worse than a wider one.
- Column visibility persists per viewer in `localStorage` under `tnp.table.<screen>.hidden`.
- **Not exercised in a browser.** Sorting, the filter and column popovers, pagination, and dark mode were verified through the production build, the unit suite, and code review only; see the credentials blocker below.

## Placement records, dashboard, and announcements, 2026-09-17

`DECISIONS.md` carries the reasoning for all three under today's date.

1. **`Offer` is the placement record.** New table plus `OfferType` and `OfferStatus`, CRUD at `/api/v1/offers` behind `applications:manage`, and `/admin/placement-records` in the sidebar and `ROUTE_PERMISSIONS`. An application is not an offer; the optional `applicationId` join is unique. `DECLINED` and `REVOKED` rows stay on file and count for nothing, a rule held in `COUNTED_OFFER_STATUSES`.
2. **The admin dashboard reads `GET /api/v1/analytics/admin/overview` and nothing else.** It is the first admin screen with no Prisma fallback. The season selector defaults to the newest season that has an offer, because the newest batch on file has usually not been placed yet.
3. **Announcements draft, publish, and split into three routes** under an expandable `Announcements` group in the sidebar: `company-event`, `general`, and the manage list. The composer walks placement season → company → event → tag and keeps the editor locked until those are filled; the chosen drive persists in the new `Announcement.jobProfileId`. Drafts are filtered server-side for anyone without `announcements:manage`, on the backend list, on the single-announcement route, and in the student dashboard's own query.
4. **Announcements carry attachments.** `AnnouncementAttachment` rows, a staged upload endpoint behind `announcements:manage`, signature checks per type in `validate_attachment`, and links shown in the admin preview and on the student dashboard. Resume upload stays PDF-only and untouched. Abandoning a draft after uploading leaves an orphan file under `announcement_docs/`; nothing sweeps those yet.
5. **Seed data covers the new tables**: eleven offers across the 2027 and 2028 seasons, and two draft announcements, so both screens have something to show on a fresh database.

Not built, and asked about in the reference design: an email dispatch when an announcement is published. Announcements notify nobody today, so the reference screen's "I have reviewed all the info and I am ready to send the email" confirmation would be describing something that does not happen; the composer says what publishing actually does instead.

## Four defect fixes, 2026-09-17

Each has a dated entry in `DECISIONS.md` with the reasoning.

1. **Eligibility now evaluates `allowedDegrees` and `allowedGenders`.** Both were stored and ignored, so a B.Tech-only job admitted an MBA student. Every criterion is now a required argument to both engines, which is what forced all six call sites to be updated.
2. **The application CSV comes from the backend.** The Export CSV control links to `/api/admin/applications/export`, which proxies `GET /api/v1/applications/admin/export`; the Resume Label column is back, and the endpoint gained a `search` parameter so the export matches the screen's free-text box.
3. **`NocRequest.adminRemarks` splits decision remarks from the student's `message`.** Approving or rejecting used to overwrite the student's text. Requests decided before this change keep whatever is in `message` and have a null `adminRemarks`; no data migration tries to guess which is which.
4. **`/admin/interview-experiences` is registered in `ROUTE_PERMISSIONS`, and the admin sidebar is derived from it.** A route missing from that map is now hidden from the navigation rather than visible and ungated.

## What changed in this pass

1. Split the repository into `frontend/`, `backend/`, and `database/`. `frontend` and `database` are npm workspaces sharing the root lockfile.
2. Added `frontend/Dockerfile`, `frontend/Dockerfile.dev`, `backend/Dockerfile`, `backend/Dockerfile.dev`, and `database/Dockerfile`, plus `docker-compose.yml` and `docker-compose.dev.yml`. Migrations run in a one-shot `migrate` container that must exit successfully before the backend starts.
3. Removed the Auth.js credentials provider and the hardcoded `placements@iiitl.ac.in` administrator. `ADMIN_EMAILS` is now the only source of the `ADMIN` role, roles are recomputed per request, and `require_admin` in the backend re-checks the allowlist.
4. Pinned `@auth/core` to `0.41.2` in root `overrides`. `next-auth` and `@auth/prisma-adapter` otherwise resolve different patch versions, which makes their `Adapter` and `JWT` types structurally incompatible and breaks `npm run type-check`.
5. Removed committed `__pycache__` bytecode and expanded `.gitignore`.
6. Made the `AUTH_SECRET` check lazy in `frontend/src/lib/auth.ts`. Throwing at module load broke `next build` inside the image, because the build runs with `NODE_ENV=production` and no secret. The check now runs when a session is actually issued.

## Known next work

1. Port the remaining direct Prisma call sites to FastAPI endpoints. `docs/FEATURE_STATUS.md` lists them under the "Prisma direct" data path; the admin surfaces and the dashboard are the bulk of it.
2. Sign in against the running stack and walk the student and admin journeys end to end, starting with Export CSV on `/admin/applications` and an approve/reject on `/admin/noc-requests`.
3. Select a storage provider and implement PDF-only resume upload with ownership checks.
4. Walk the announcement composer, `/admin/placement-records`, and the new shared table's sorting, filter popovers, column menu, and pagination in a browser, which needs an admin password on the target machine (`npm run db:set-password -- <email>`).
5. Add encrypted Aadhaar/PAN profile actions using the existing encryption helper.

## Watch out for

- `frontend/next.config.ts` loads the root `.env` through `process.loadEnvFile`, because Next only reads `.env` from its own directory. Removing that breaks host-side `npm run dev`.
- Compose deliberately ignores the root `DATABASE_URL` and builds an in-cluster URL from `POSTGRES_*`. The `.env` value points at `localhost` and is only correct for host-side tooling.
- Next.js workspace builds nest the standalone server at `.next/standalone/frontend/server.js`, which is why the runner stage copies that layout and runs `node frontend/server.js`.
- `TEST_LOGIN_ENABLED`, `TEST_STUDENT_EMAIL`, `TEST_STUDENT_PASSWORD`, `TEST_ADMIN_EMAIL`, and `TEST_ADMIN_PASSWORD` are dead variables, and so are `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` since sign-in became password-only on 2026-09-17.
- An administrator seeded from `ADMIN_EMAILS` has no password and therefore cannot sign in until someone runs `npm run db:set-password -- <email>`. This is the first thing to do on a fresh deployment, and the usual cause of "nobody can log in".
- Do not reintroduce module-scope environment validation in `frontend/src/lib/auth.ts`. `next build` evaluates that module without runtime secrets, so any throw there fails the image build. Compose already fails fast on missing secrets through `${VAR:?}`.

## Handoff template

Copy this section when handing off active work:

```text
Objective:
Owner/agent:
Branch:
Files changed:
Behavior completed:
Verification run:
Known failures:
Blockers/credentials needed:
Recommended next action:
```

Do not place secrets, tokens, private student information, or uploaded files in this document.
