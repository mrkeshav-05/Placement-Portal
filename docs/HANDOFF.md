# Team Handoff

This file carries short-lived working context between teammates and agents. Canonical architecture belongs in `PROJECT_CONTEXT.md`; durable decisions belong in `DECISIONS.md`.

## Current state

- Active objective: finish moving data access from Prisma-in-Next.js to FastAPI endpoints
- Active owner: unassigned
- Branch: main working tree contains the service split, containerization, and the auth rework
- Last verified (2026-09-18, bulk placement records pass): `npm run lint` (the same pre-existing `DATE_FMT` warning), `npm run type-check`, `npm run build` with `/admin/placement-records/add` registered, 126 frontend unit tests, and 158 backend pytest tests including 8 new ones covering the bulk endpoint's partial-result semantics. **Not walked in a signed-in browser**: the Cursor browser holds a redirect-looping cookie for `localhost:3000` that cannot be cleared through CDP, and nobody on this machine has an admin password to hand. `http://127.0.0.1:3000` is a clean cookie origin and renders the login page, so that is the way in.
- Last verified (2026-09-18, Makefile/containerisation pass): `make up` from a stopped stack to all three services healthy, `make seed` loading 445 roster students plus the demonstration dataset, `make test-backend` (148 pytest tests in the container), `make db-dump`, the `db-remove-demo`/`db-seed-demo` round trip, `make db-studio` answering on port 5555, and the `.env` bootstrap and `make admin` allowlist edit exercised in a scratch directory so the real `.env` was untouched.
- Last verified (2026-09-18, admin data grid pass): `npm run lint` (the same pre-existing warning), `npm run type-check`, `npm run build`, 122 frontend unit tests, and all 12 admin tables measured in a signed-in browser in both themes. No backend file changed, so pytest was not re-run.
- Last verified (2026-09-18, shadcn admin pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, and 122 frontend unit tests. No backend file changed, so pytest was not re-run.
- Last verified (2026-09-18, Add Company pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 122 frontend unit tests, and 148 backend pytest tests in the running `backend` container.
- Last verified (2026-09-17, events pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 119 frontend unit tests, and 148 backend pytest tests in the running `backend` container.
- Last verified (2026-09-17, shared admin data table pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 104 frontend unit tests, and `docker compose up -d --build frontend` with all containers healthy. The 115 backend pytest tests were last run in the announcements pass; this pass changed no backend file.
- Not yet exercised in a browser: every signed-in journey, including the new dashboard, `/admin/placement-records`, and the announcement composer. Nobody has a known admin password on this machine — `placements@iiitl.ac.in` has a hash set by the repository owner — so the screens were verified through the production build, the unit and pytest suites, and SQL against the seeded development database rather than by clicking. The four defect fixes below are covered by unit tests and, for the application export, by running its SQL against the development database; nobody has clicked Export CSV or approved a NOC in the browser.
- External blocker: resume/document storage provider has not been selected

## Bulk placement records, 2026-09-18

`/admin/placement-records/add` records one drive's outcome for a pasted list of
roll numbers. The single-record dialog on the list page was kept, so there are
now two ways in and the heading carries both.

What to know before touching it:

- **The endpoint returns a partial result on purpose.** `POST
  /api/v1/offers/bulk` responds 201 even when it wrote nothing, with `created`
  and a `skipped` list. The caller has to read both; the server action turns a
  zero-created response into an error message and keeps the skipped rows on
  screen to be corrected. Do not "fix" this into a 4xx.
- **`Offer.jobTitle` reads with a fallback.** `OfferResponse.jobTitle` is
  `offer.jobTitle or jobProfile.title`, so the response cannot tell you which
  one it came from. The edit dialog therefore prefills the resolved value, and
  saving it copies a drive's title onto the record. That is accepted: the
  administrator saw the value. If it ever matters, expose the raw column and
  the drive title as two fields rather than guessing in the frontend.
- **Type and status were deliberately not renamed.** The reference screenshots
  show a different vocabulary; the 2026-09-18 entry in `DECISIONS.md` says why
  the portal keeps its own. Changing them is a Prisma enum migration plus
  `placement_stats.py`, `analytics.py`, and the seed data.
- **Not verified by clicking.** See the unverified boundary in Current state
  above.

## Running the project, 2026-09-18

`make` is the front door now. `make up` and `make seed` are the two commands a
new contributor needs; `make help` prints the rest, generated from the `##`
comment on each target, so it cannot drift.

What to know before touching it:

- **`make db-*` runs in the `tools` service**, which shares the `migrate` image
  and sits behind a Compose profile. A profile is the only thing keeping it out
  of `up`; remove it and every `docker compose up` would run a seed container.
- **The image bakes in `database/` and `students_data.json`.** A new migration
  or an edited roster needs a rebuild (`make build`), the same trap the
  `migrate` container has always had.
- **`make password` must not pass `-T`.** The script prompts on stdin, so it
  needs the TTY that `docker compose run` allocates by default.
- **`make env` never invents an administrator.** `ADMIN_EMAILS` stays empty
  until someone runs `make admin EMAIL=…`; `make up` prints a reminder when it
  is still blank.
- **`make db-pack-demo` and `make check` run on the host** by design, noted in
  their help text. Both write or read the working tree.

Left alone deliberately: the npm scripts, which still work for anyone running a
service outside Docker, and `docker-compose.dev.yml`, which `make dev` uses
unchanged. `backups/` is gitignored, since `make db-dump` writes there.

## The admin data grid, 2026-09-18

All 12 tables across the 11 admin screens already shared one `DataTable`, and
there was no second table implementation anywhere, so this pass restyled the
shared component instead of migrating anything.

What moved into `DataTable`: the section heading (`title`), the live row count
beside it, the list's buttons (`actions`), and a single bordered `.dt-card`
wrapping the search, the grid, and the pagination. `toolbarActions` is gone —
nothing used it. Each manager now passes `title`; the applications screen also
passes its export buttons through `actions`, and its old `.registrations-card`
markup and CSS are deleted. Every page keeps its own `<h1>` and filters.

Two defects were found and fixed on the way, both pre-existing:

- 56 column widths were `minmax(120px, 1fr)`, a CSS Grid function that a table
  cell ignores, so no admin table had ever honoured a declared width. They are
  now the px minimum each one named.
- Deriving pinned-column offsets from those declared widths does not work: a
  declared 70px renders at 91px once padding lands, so the second pinned column
  overlapped the first by 21px. Offsets are now measured from the rendered
  header cells through a `ResizeObserver`, keyed off the visible column set.

Verified in the browser, signed in as the super admin, on every table: the
three-state sort cycle with `aria-sort` following it, numerically correct
sorting (CGPA ascending gives 8.22 before 10, not "10" before "8.4"),
search, horizontal scrolling with S.No and Roll Number pinned, the export modal
capping at exactly 85vh with a scrolling body and a fixed footer, and the same
metrics on all 12 tables (50px header at 15px/600, 61px rows, 440x44 search).

Known and deliberate:

- The team directory has no sortable column. Its row order *is* the published
  display order and the arrows in its Order column are how that changes, so
  sorting it would contradict the feature. Left alone.
- One announcements row is 71px rather than 61px because it carries a third
  metadata line. `height` is a minimum; clipping real data to hit the number
  would be worse.
- Only the registrations table configures the export column picker. The
  students and offers screens export without one.
- The spec this pass followed asked for a #FF1744 accent. It was declined in
  favour of the institute blue, so the grid works in dark mode. See
  `DECISIONS.md`.
- Inter is now the only typeface. This is the change that was sitting in
  `git stash`; it has been applied directly, so that stash entry is redundant
  and can be dropped.

## shadcn/ui for the admin forms and dialogs, 2026-09-18

`DECISIONS.md` carries the reasoning under today's date. Nothing about persistence, authorization, or validation changed in this pass; it is the presentation layer only.

1. **Scope.** Both composer forms, all 20 admin dialogs, the two shared pickers, and every status banner. **The student portal and the admin data tables were deliberately left alone**, which is why `.modal-backdrop` and the `dt-*` CSS still exist. `FEATURE_STATUS.md` has a new *UI component migration* table with the per-surface boundary.
2. **`AdminDialog` is the one admin dialog shell** (`components/common/admin-dialog.tsx`). Pass `eyebrow`, `title`, and a `className` for the width; do not re-add a backdrop div. Radix now supplies the focus trap and Escape, which no dialog had before.
3. **Eleven primitives were added** by `npx shadcn@latest add`: card, textarea, checkbox, switch, popover, separator, alert, scroll-area, toggle, toggle-group, command. They import `cn` from the `cn` package and Radix from the unified `radix-ui` package, matching the six that were already here.
4. **`globals.css` gained shadcn's missing `@layer base` rule.** Without `* { @apply border-border outline-ring/50 }`, every bare `border` in a shadcn component resolved to `currentColor` — a near-white hairline on cards, inputs, and dialogs in dark mode. If a hand-written rule ever loses its border colour, this layered rule is the fallback it now picks up.
5. **279 lines of orphaned CSS were deleted** across `globals.css` and `admin.css` (the `event-form`/`field-*`/`choice-*`/`check-*`/`branch-*`/`time-*`/`switch`/`form-card`/`confirm-row`/`company-picker-*`/`admin-success` families). Each was confirmed to have no `className` reference first. `.rdp-*` was kept — react-day-picker generates those at runtime, so grep cannot see them.
6. **Two `__none` sentinel selects exist** because Radix refuses an empty-valued item: the announcement's company and the placement record's drive. Both post the real empty string. Every posted field name in the six migrated managers was diffed against `git show HEAD:` and is identical.

**Exercised in a browser.** On `/admin/events/add`: the company command palette, the deadline popover (month grid plus quarter-hour list, past days disabled), the degrees dialog, and Escape-to-close. On `/admin/companies/add`: the pills, session select, and gating checkbox. The permission matrix was opened in dark mode and its computed border read back as `#1F3A60` rather than the near-white it was before the base-layer fix. **Not clicked: an actual save through any migrated dialog** — provisioning a user, setting a password, approving a NOC, responding to a feedback, or saving a placement record. The field names are verified by diff, not by submission.

**Known cosmetic regression.** Radix renders a select's value client-side, so Placement Year and Batch paint blank for one frame before hydration.

**The Inter font change is still in `stash@{0}`, and it will now conflict.** It edits `layout.tsx` (no conflict) plus the `font-family` declaration in 45 rules across `globals.css` and `admin.css`. This pass deleted some of those very rules and added a block near the top of `globals.css`, so `git stash pop` will report conflicts in both stylesheets. Resolve by keeping this pass's structure and re-applying only the `var(--font-jakarta)` → `var(--font-inter)` substitution to the rules that survive.

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
