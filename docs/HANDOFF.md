# Team Handoff

This file carries short-lived working context between teammates and agents. Canonical architecture belongs in `PROJECT_CONTEXT.md`; durable decisions belong in `DECISIONS.md`.

## Current state

- Active objective: finish moving data access from Prisma-in-Next.js to FastAPI endpoints
- Active owner: unassigned
- Branch: main working tree contains the service split, containerization, and the auth rework
- Last verified (2026-09-20, season picker pass): `npm run lint`, `npm run type-check`, and 130 frontend unit tests, twice — once for making the whole pill clickable and swapping the icon, and again for the follow-up (label reworded to "Select Season", icon and text recoloured to `--ink` instead of `--blue`, and `SelectContent` switched from Radix's default item-aligned placement to `position="popper"` with `align="start"` so the list opens directly under the bar at the bar's own width instead of centring over whichever row was selected). Only `admin-dashboard.tsx` changed both times — no backend or business-logic file — so pytest was not re-run. Checked in a browser both times on a temporary, unauthenticated route rendering `AdminDashboard` with mock data (deleted afterwards, same technique as the sidebar pass below): the pill collapses to a single `combobox` in the accessibility tree; clicking anywhere in it (not just the value text) opens the listbox; the open list was screenshotted in light mode and matches the user's reference image — black calendar icon, "Select Season 2028" in black, list directly beneath the bar at its width, checkmark on the current year. `overview.seasons` is computed from real `Offer.batch` rows on the backend (`analytics.py`), not a hardcoded range, and the seeded data already yields exactly `[2027, 2028]`, so no season-list change was needed. One more pass changed course from the previous entry: rather than keeping a title-less topbar on every non-Overview admin page, the topbar is now removed outright on those pages, and the controls it carried — sidebar-collapse trigger, theme toggle, profile/sign-out menu — moved into the sidebar's own footer. The Overview page (`/admin/dashboard`) is untouched: same `<header className="admin-topbar">`, same title, same controls, in the same place. The footer's copy opens its dropdown upward (`bottom-full`) rather than down, since it sits at the screen's bottom edge; both copies share one `renderProfileMenu(align)` closure and one `profileOpen` state rather than forking the sign-out form. In the icon-collapsed rail, the name/role text next to the avatar hides (`group-data-[collapsible=icon]:hidden`), matching how the sidebar header already hides its own text at that width.

A follow-up fixed a real layout bug this introduced and removed the "Open student portal" link entirely (it is gone from the sidebar footer on every page, not just non-Overview ones — `SidebarFooter` itself is now only rendered when `!isOverview`). Collapsed to the icon rail, `SidebarTrigger` and `ThemeToggle` had been laid out side-by-side in a row narrower than their combined width, so they overflowed past the rail's right edge into the content area. Fixed by stacking trigger, theme toggle, and the profile avatar into a single column (`group-data-[collapsible=icon]:flex-col`) whenever the rail is collapsed, at every level of that row's flex nesting — one `flex-col` on the outer row was not enough since the inner `trigger + theme` pairing was still a row. Verified on a temporary, unauthenticated route (deleted afterwards, pathname never matches `/admin/dashboard` so it always exercises the "other page" branch), rebuilt into the actual `docker compose` frontend image since `make up` runs a production build that a source edit alone does not refresh: screenshotted the expanded footer (no portal link, controls in one row) and the collapsed rail (everything stacked in one column, nothing overflowing) in both light and dark mode. `npm run lint`, `npm run type-check` (after clearing the stale `.next/dev/types` cache the deleted preview route left behind), and 130 frontend unit tests pass; no backend file changed.
A later pass shrank the company-event composer's season/company/event pickers and put all three on one row (`frontend/src/components/admin/announcement-composer.tsx`, `frontend/src/app/admin.css`). They were `.composer-row.two` (season + company) stacked above a separate full-width row for event; now all three sit in one `.composer-row.three` (`grid-template-columns: 1fr 1fr 1fr`). The event field's dropdown used to anchor to that whole row (`position: relative` on `.composer-row`, `ref={eventRef}` on the row); moved both onto a new `.composer-field-wrap` around just the event button so the dropdown still anchors correctly now that it shares the row with two other fields instead of owning it. Field padding dropped from `13px 16px` to `9px 12px`, icon/tick sizes from 15px/14px to 13px/12px, matching "little small" — this only touches the company-event composer's own CSS classes, not shared filter or table controls elsewhere. Verified on a temporary, unauthenticated route rendering `<AnnouncementComposer category="COMPANY_EVENT" .../>` directly with mock companies/events (deleted afterwards): screenshotted the collapsed row, then stepped through selecting a season, a company, and opening the event dropdown to confirm it still opens under its own field without overlapping the season/company fields. `npm run lint`, `npm run type-check`, and 130 frontend unit tests pass; rebuilt the `frontend` Docker image since `make up` serves a production build.

A further pass reworked the announcement composer's tag picker into toggle pills (dashed border unselected, filled institute blue once clicked — the same "nothing chosen yet" convention `.dt-filter-button` already uses elsewhere), added a small text input for tags outside the suggestion list, coloured "Publish to students" with `--green` instead of the institute-blue default (the one action on that screen that isn't reversible from the same page), and widened the composer pages only (`.admin-page.composer-page`, 1560px against the shared 1280px) so the funnel needs less scrolling to reach the publish button. It also asked, and was told, to hide the admin topbar's "Administration / Placement Operations" title on every admin page except `/admin/dashboard` (which has no heading of its own) — the sidebar toggle, theme toggle, and profile/sign-out menu stay on every page, since there's no other way to reach them. All four changes verified on a temporary, unauthenticated route (deleted afterwards): the tag pills screenshotted in both states, the green button screenshotted after filling the funnel to enable it, and the topbar title's absence confirmed both in the accessibility tree and a screenshot showing the trigger/theme/profile controls still present. `npm run lint`, `npm run type-check`, and 130 frontend unit tests pass each time; no backend file changed.
A follow-up removed the "Recent company event announcements" list from `/admin/announcements/company-event` entirely — it duplicated the same feed already on `/admin/announcements`, one click away via the page's own "Active & drafts" link, and the composer form is now the whole page. Dropped the `RecentAnnouncements` usage and its now-unneeded `db.announcement.findMany` query from that page only; the component and its identical usage on `/admin/announcements/general` are untouched, since removing it there wasn't asked for and that page has no equivalent link elsewhere. `npm run lint`, `npm run type-check`, and 130 frontend unit tests pass; no backend file changed. Not viewed signed in, same reason as everywhere else in this file — the change is a deletion (one `<RecentAnnouncements>` block and the query that fed it), verified by reading the diff and by the page still compiling and 307-ing to `/login` unauthenticated as before.
A third pass added `w-[var(--radix-select-trigger-width)]` alongside the existing `min-w-`, after a user screenshot showed the list narrower than the bar: the CSS itself already computed to an exact match (confirmed with `getComputedStyle`), and the apparent gap was the list's own `zoom-in-95` open animation caught mid-transition — a `getBoundingClientRect()` taken immediately after the click read 178px against a 187px trigger, exactly 95% of it. The `w-` class is there so a shrink-to-content list (e.g. one whose longest label is shorter than the trigger) can't ever render narrower once the animation settles, even though it wasn't the cause of what was screenshotted. Sidebar logo transparency and size, from the same session, was checked by direct DOM inspection rather than a fresh screenshot.
- Last verified (2026-09-20, Redis cache pass): `npm run lint`, `npm run type-check`, `npm run build`, 130 frontend unit tests, and 197 backend pytest tests including 23 new ones over the cache. Exercised against the running dev stack with real PostgreSQL and real Redis, through the API rather than the browser: `GET /api/v1/announcements` 90.2ms cold and 1.1ms warm with identical bodies, `GET /api/v1/jobs` 69.3ms and 1.1ms over 7 rows in deadline order with the company name present, `?activeOnly=true` narrowing to the 5 ACTIVE rows, `GET /api/v1/jobs/{id}` 44.7ms and 2.3ms, an unknown id still 404, `POST /api/v1/cache/invalidate` returning 202 and the next read missing again, and the same call from a student refused with 403. `make cache-stats` read back 1 entry per topic with a live TTL. **The two ported pages were not viewed signed in**: `/dashboard` and `/company-events` both 307 to `/login`, and `make password` prompts on a TTY for a credential that is the repository owner's to set. What that leaves unchecked is only the rendering — the payload each page consumes is the verified one above, and the mapping is type-checked and builds.
- Last verified (2026-09-20, sidebar pass): `npm run lint`, `npm run type-check`, `npm run build`, and 130 frontend unit tests. No backend file changed, so pytest was not re-run. Both shells were exercised in a browser on a temporary public route (deleted afterwards) in light and dark: grouped items expanding, the icon rail, the mobile drawer at 420px, and the measured 15px/40px rows. See the section below for what that harness could not cover.
- Last verified (2026-09-20, typography pass): `npm run lint`, `npm run type-check`, `npm run build` (27 self-hosted `.woff2` files, i.e. both Plex faces resolved and subset at build time), and 130 frontend unit tests. No backend or Python file changed, so pytest was not re-run. Checked in a browser against the running dev stack, unauthenticated: the login and register pages in both themes, with computed styles read back through CDP — `IBM Plex Sans` as the computed family on body, headings, labels and buttons; real 400/500/600/700 files in `document.fonts` rather than a synthesised weight; `-0.862px` of tracking on the 43.1px hero (`-0.02em`) and `normal` on everything small. Because `admin.css` is imported into `globals.css` and so is global, the two new rules were measured on that same page through injected probes: `.identifier` computes to `IBM Plex Mono` and pulls the file down, and `.dt-table` yields `tabular-nums` with `"1111111111"` and `"0000000000"` both at exactly 96.00px. **The signed-in admin screens were not looked at**, for the standing reason that nobody on this machine has an admin password. What that leaves unchecked is only whether the lighter 600 headings and the relaxed tracking sit well against the grid's fixed 50px header and 61px rows; the font mechanics themselves are confirmed above.
- Last verified (2026-09-18, database table browser pass): `npm run lint`, `npm run type-check`, 130 frontend unit tests, and 174 backend pytest tests including 16 new ones over the password gate and the generated views. The browser itself was exercised against the running dev stack over HTTP: a wrong password rejected with 400, the right one setting a `tnp_db_admin` cookie, all 15 list pages answering 200, the `User` details page carrying all 41 columns, search matching one row out of the roster, and a throwaway `TeamMember` row created, edited, and deleted with the result read back through `psql`. Dark mode was checked in a browser: the real login page in both themes, and — because signing in needs the live `DB_ADMIN_PASSWORD`, which belongs to the repository owner rather than in an agent transcript — the list page and the `User` edit form were saved with `curl` and served from a scratch static server, which runs sqladmin's real markup against its real CSS and JavaScript. That confirmed the toggle cycling light/dark/system with its icon and label, the default following `prefers-color-scheme`, and the computed colours of the flatpickr calendar and the select2 tag field. The only thing that harness cannot show is the icon font, which is CORS-blocked from a foreign origin; on port 8000 it is same-origin. **The signed-in pages have still not been clicked through on the real origin.** `npm run build` was not re-run because no frontend file changed in this pass; the production backend image was not rebuilt either, but both Dockerfiles install from the one `requirements.txt` the dev image already built from, and nothing in `.dockerignore` excludes the Jinja templates.
- Last verified (2026-09-18, bulk placement records pass): `npm run lint` (the same pre-existing `DATE_FMT` warning), `npm run type-check`, `npm run build` with `/admin/placement-records/add` registered, 126 frontend unit tests, and 158 backend pytest tests including 8 new ones covering the bulk endpoint's partial-result semantics. **Not walked in a signed-in browser**: the Cursor browser holds a redirect-looping cookie for `localhost:3000` that cannot be cleared through CDP, and nobody on this machine has an admin password to hand. `http://127.0.0.1:3000` is a clean cookie origin and renders the login page, so that is the way in.
- Last verified (2026-09-18, Makefile/containerisation pass): `make up` from a stopped stack to all three services healthy, `make seed` loading 445 roster students plus the demonstration dataset, `make test-backend` (148 pytest tests in the container), `make db-dump`, the `db-remove-demo`/`db-seed-demo` round trip, `make db-studio` answering on port 5555, and the `.env` bootstrap and `make admin` allowlist edit exercised in a scratch directory so the real `.env` was untouched.
- Last verified (2026-09-18, admin data grid pass): `npm run lint` (the same pre-existing warning), `npm run type-check`, `npm run build`, 122 frontend unit tests, and all 12 admin tables measured in a signed-in browser in both themes. No backend file changed, so pytest was not re-run.
- Last verified (2026-09-18, shadcn admin pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, and 122 frontend unit tests. No backend file changed, so pytest was not re-run.
- Last verified (2026-09-18, Add Company pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 122 frontend unit tests, and 148 backend pytest tests in the running `backend` container.
- Last verified (2026-09-17, events pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 119 frontend unit tests, and 148 backend pytest tests in the running `backend` container.
- Last verified (2026-09-17, shared admin data table pass): `npm run lint` (one pre-existing unused-variable warning in `profile-view.tsx`), `npm run type-check`, `npm run build`, 104 frontend unit tests, and `docker compose up -d --build frontend` with all containers healthy. The 115 backend pytest tests were last run in the announcements pass; this pass changed no backend file.
- Not yet exercised in a browser: every signed-in journey, including the new dashboard, `/admin/placement-records`, and the announcement composer. Nobody has a known admin password on this machine — `placements@iiitl.ac.in` has a hash set by the repository owner — so the screens were verified through the production build, the unit and pytest suites, and SQL against the seeded development database rather than by clicking. The four defect fixes below are covered by unit tests and, for the application export, by running its SQL against the development database; nobody has clicked Export CSV or approved a NOC in the browser.
- External blocker: resume/document storage provider has not been selected

## Both shells run on shadcn's Sidebar, 2026-09-20

`admin-shell.tsx` and `portal-shell.tsx` no longer hand-roll a nav rail; both
render `components/ui/sidebar`, and the 173 lines of CSS that backed the old
ones are gone from `globals.css` and `admin.css`. Nav rows went from 12px to
15px, sub-rows from 11.5px to 14px. Reasoning and the three deliberate
departures from the generated component are in `DECISIONS.md` under
2026-09-20.

Worth knowing:

- **`components/ui/sidebar.tsx` is edited, not stock.** The row sizes, the
  17.5rem width and the institute-blue `data-[active=true]` styling live in
  its `cva` variants so both shells inherit them. Re-running
  `shadcn add sidebar --overwrite` silently reverts all of that, and the
  result is a working sidebar that is simply smaller and grey, which is easy
  to miss in review.
- **The generator also rewrites `globals.css`.** It appends eight literal
  `hsl()` `--sidebar-*` values and a trailing `.dark` block. Both were
  replaced with aliases onto the existing tokens. If a future `shadcn add`
  puts them back, that is the thing to delete.
- Permission filtering is untouched: `visibleNav` still prunes against
  `allowedPaths` before any menu renders, and a group with no permitted
  children still disappears.

Verified against the running dev stack by rendering both shells on a
throwaway public route with fabricated props, since nobody here has an admin
credential; the route was deleted afterwards. That covered both themes, the
expand/collapse of the grouped items, the icon rail, and the mobile drawer at
a 420px emulated viewport. Measured: 15px/40px rows, 14px/36px sub-rows,
280px rail, and an active row resolving to the institute blue with its 3px
inset marker. **What the preview could not show is the active state arising
naturally**, because its own path matches no nav entry — the styling was read
back by forcing the attribute, so the CSS is right, but nobody has watched the
highlight follow a real navigation. Nor has anyone seen the sidebar against a
real admin data grid.

## The typeface is IBM Plex Sans, 2026-09-20

The brief was that the portal looked generated. The typeface was only half of
it: 41 of the 42 headings across `globals.css` and `admin.css` were `font: 800`
regardless of size, with tracking down to `-0.05em`, which is the AI landing
page look rather than anything Inter did wrong. Reasoning and full detail are
in `DECISIONS.md` under 2026-09-20; the short version is Plex Sans at 600 for
headings, negative tracking only above 24px, tabular figures on `.dt-table`
instead of the 14 hand-tagged cells, and Plex Mono behind a new `.identifier`
class for roll numbers.

Two things to know before touching this again:

- **Do not rename the `next/font` variables to `--font-sans`/`--font-mono`.**
  Those are Tailwind theme keys, and `@theme inline` inlines its values into
  utilities rather than emitting custom properties, so the hand-written
  `var(--font-sans)` in both stylesheets resolves to nothing. An invalid
  `var()` inside a `font` shorthand voids the entire declaration instead of
  falling through to the next family, so the whole portal renders in the
  browser's default serif. It is a striking failure and an easy one to
  reintroduce; I shipped it for one screenshot. The variables are
  `--font-plex-sans` and `--font-plex-mono`, and `@theme inline` maps the
  Tailwind keys onto them so shadcn's `font-sans` gets Plex too.
- Plex has no weight 800. Anything that wants to be heavier than the 600 this
  pass settled on has 700 as its ceiling, and asking for more gets a
  synthesised face that looks smeared.

Still unlooked-at: the signed-in admin screens, same password reason as
everywhere else in this file. The mechanics are measured (see the verification
line above); what nobody has judged is whether 600 headings sit well against
the grid's fixed 50px header and 61px rows.

## A stale test fake and a column added upstream, 2026-09-18

`make test-backend` had four failures in `tests/test_offers_bulk.py`, all of
them a 500 the test reported only as `Internal Server Error` because the
client is built with `raise_server_exceptions=False`. The merge from `origin`
added `Offer.source`, `_to_response` now reads it, and the `SimpleNamespace`
that stands in for a saved row predates the column, so the attribute lookup
raised. Fixed by giving the fake a `source`.

Worth knowing for the next one: a hand-built fake row goes stale silently
every time a column is added, and the failure surfaces as a bare 500 several
layers from the cause. Re-running the endpoint under
`raise_server_exceptions=True` in a scratch script is what showed the
`AttributeError`.

## The database table browser, 2026-09-18

`http://localhost:8000/admin` is new, and is not the admin portal. It is
`sqladmin` over the SQLAlchemy models, reaching every column of all 15 tables
with no reference to the RBAC catalog. `DB_ADMIN_PASSWORD` is the whole
boundary; the reasoning, including why it is permitted in production, is in
the 2026-09-18 entry in `DECISIONS.md`.

Two things to know before touching it:

- The views are generated from the mapper in `backend/app/admin/views.py`, so
  a column added by a migration and mirrored into `app/models/db.py` shows up
  with no edit here. The per-model dictionaries at the top of that file are
  presentation only — sidebar grouping, default sort, and which columns the
  wide tables preview in their list.
- A row created here generates its own `id`, because Prisma's `cuid()` runs in
  the Prisma client and the migrations give the column no database default.
  That id is not a cuid and does not try to be.

Not done: nobody can tell who changed a row. `sqladmin` emits audit events
that `mount_admin` does not subscribe to, which is the obvious next step if
this gets used on real data.

### Adding a template override needs a backend restart

The templates in `backend/app/admin/templates/sqladmin/` are found ahead of
sqladmin's own copies, but only by an environment that has not already cached
the name. Jinja caches a compiled template against the loader that resolved
it, and `PackageLoader`'s freshness check looks at the installed file, which
never changes — so a *newly added* override is ignored until the process
restarts, while the pages keep returning 200 and quietly render the package
version. `base.html` and `layout.html` both looked like no-ops for exactly
this reason. Editing an override that is already in place is picked up
normally, by mtime; uvicorn's reloader only watches `*.py`, so neither case
reloads on its own under `make dev`.

## The table's view notification is guarded, 2026-09-18

`/admin/applications` and `/admin/team` were throwing `Maximum update depth
exceeded` from `DataTable`'s `onViewChange` effect. Both callers set state from
that callback — `setView` and `setVisibleMembers(view.rows)` — and every caller
writes `searchText` as an inline arrow. A new function identity on each render
rebuilds the `applyTablePipeline` memo, so `result` is a new object, so the
effect fires, so the caller sets state, so the table re-renders, forever. The
existing ref around `onViewChange` did not help: the unstable prop was the
search mapper, not the listener.

The fix is `sameTableView` in `src/lib/data-table.ts`, which the effect consults
before notifying. It compares the view's contents — including rows element by
element, because the pipeline rebuilds the array out of the same row objects —
so a render that changed nothing notifies nobody. Four unit tests cover it.

Two things not to do here:

- **Do not hold `searchText` in a ref.** It was the first attempt and the React
  compiler lint rule refuses it: the pipeline runs during render, so the ref
  would be read during render. The guard lives in the effect for that reason.
- **Do not assume memoising the callers is enough.** Stabilising `searchText`
  at 11 call sites would also stop the loop, but the next inline prop
  reintroduces it. The guard holds regardless of what a caller passes.

## A compile error that outlives its fix, 2026-09-18

`make dev` served `CssSyntaxError: admin.css:1472:1: Missing closing }` on every
page, against a file that was balanced on disk, in the container, and in a
clean `npm run build`. The error was a Turbopack cache entry, poisoned by a
watcher that read `admin.css` mid-write while an editor was rewriting it.

It survived `down`, `up --build`, and recreating the container, because
`frontend/.next` is the `frontend_next` **named volume** — declared in
`docker-compose.dev.yml` so container builds never write into the host tree.
Named volumes are not removed by `down`; only `down -v` or an explicit
`docker volume rm` touches them.

`make clear-cache` is the way out. It removes the frontend container with its
volumes and leaves the database alone, which `make clean` does not. Reach for it
whenever a compile error keeps being reported after the file is demonstrably
fine: check the brace balance once, and if it is even, the file is not the
problem.

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

## Portal-wide shadcn pass and CSS layering, 2026-09-18

Both sides of the portal are on shadcn now, and the hand-written stylesheets
moved into `@layer components` so those components actually win the cascade.
Read the two 2026-09-18 entries in `docs/DECISIONS.md` first; the layering one
changes how you write CSS here.

**Verified in the browser, signed in as a seeded demo student.** The interview
experiences page end to end: composer opens, company picker searches and
commits, every Select posts through its hidden input, the section counter and
per-group badges track what is filled, submit stays disabled until one section
is, the submission saves and lands in My submissions as Pending review with
topic tags, an approved row appears under Browse, search matches words that
only occur in an answer body, and the reader groups filled sections under
their headings. All ten student routes render. Login and register were
measured after the CSS cleanup: controls are 44px, the submit button is the
institute blue. Profile's selects show their values and post the right names.

**Not verified.** No admin screen was opened. `admin.css` is now layered, so
every admin control where a shadcn utility and a `dt-*` or `admin-*` rule name
the same property resolves the other way round than it used to — that is the
intended effect, but the data grid's metrics were specified in pixels and
nobody has looked at them since. Start there. `account/password` was also not
opened, though it is the same shell as the two auth pages that were.

**Three defects fixed in passing, all found during the conversion.** An
unlocked Aadhaar, PAN, or college ID left its object URL alive for the life of
the tab, so the decrypted file stayed fetchable after the preview closed;
`closePreview` now revokes it, and checks the scheme so a resume's server URL
is untouched. The NOC view showed a failed submit's error inside the unrelated
cancel confirmation, because both dialogs share one `formError`. The feedback
submit button read "Google sign-in required", which contradicts the
credentials-only decision of 2026-09-17.

**Dead CSS removed.** Layering made it obvious which rules the components
had taken over. 368 lines went, across 60 rule sets whose selectors can no
longer match anything: the whole `.job-filters`, `.compact-filters`,
`.form-grid`, `.admin-toolbar`, `.composer-*`, and `.export-columns-*` blocks
among them. Two categories were deliberately kept — the `rdp-*` rules, which
react-day-picker applies itself, and `tone-1` through `tone-5`, which
`team-view.tsx` builds as `tone-${index % 5}`. Neither appears in any JSX, so
a plain grep will call them orphans again; they are not.

**Known debt.** `companyColor()` in `frontend/src/lib/job-presenters.ts`
returns five literal hex values, which breaks the no-literal-hex constraint and
is not theme-aware; it is why the two company-initial swatches still carry an
inline style. `announcement-composer.tsx` still has inline dropdowns on the
`useDismissOnOutsideClick` hook rather than `Popover`. `FeedbacksManager` and
`NocRequestsManager` both accept a `canPersist` prop that neither reads, while
their pages compute and pass it — either wire it to the mutating control as
`announcements-manager.tsx` does, or drop it from all four files.

## Redis cache, 2026-09-20

`GET /api/v1/announcements` and `GET /api/v1/jobs` now read through Redis, and
`/dashboard` and `/company-events` were moved off Prisma onto them. The design
and its reasoning are in the 2026-09-20 entry in `DECISIONS.md`; what follows
is what a reader needs in hand before touching it.

**The viewer has to be in the cache key.** `cache.get_or_set` takes a mapping
of everything that changes the answer, and for announcements that includes
`drafts`. Adding a filter to one of these endpoints without adding it to the
key will serve one caller's rows to another. There is a test for exactly this
(`TestAnnouncementVisibilityUnderCache`); keep it passing.

**Invalidation crosses a process boundary.** Event writes and the announcement
fallback still run Prisma in Next.js, and call `POST /api/v1/cache/invalidate`
through `frontend/src/lib/cache-invalidation.ts`. Any new Prisma write to
`JobProfile` or `Announcement` must do the same or the API will serve the old
copy until `CACHE_TTL_SECONDS` expires. The whole mechanism is deletable once
those writes move to the API.

### Two pre-existing bugs this pass had to fix

Both were on endpoints nothing called until these pages started calling them.

- **Students could see draft announcements.** `_may_see_drafts` tested
  `has_permission(caller, PERM_ANNOUNCEMENTS_VIEW)`, but that permission is in
  `STUDENT_SCOPED_PERMISSIONS` — it is also what lets a student read published
  notices — so it was true for every student and the draft filter never
  applied. `GET /api/v1/announcements` had been returning drafts to any
  signed-in student. It went unnoticed because the student dashboard read
  Prisma with an explicit `status: "PUBLISHED"`, and porting it to this
  endpoint would have made the leak live. The gate now requires
  `has_any_admin_permission` first. Worth checking whether any other router
  uses a `STUDENT_SCOPED_PERMISSIONS` member as an admin test; this was found
  by accident rather than by audit.
- **`GET /api/v1/jobs` returned 500 for every row.** All five array columns on
  `JobProfile` are nullable in Postgres despite Prisma declaring `String[]`,
  and all 8 seeded rows have `attachments` NULL, which `list[str]` rejects.
  A `mode="before"` validator on `JobBase` now reads NULL as empty. The
  columns could instead be backfilled and made NOT NULL in a migration, which
  would be the tidier fix and is not done here.

### Known gaps

- `/dashboard` and `/company-events` have not been viewed signed in; see the
  verification note above for why and for what was checked instead.
- `GET /api/v1/jobs/{id}` dereferences the caller's `User` row without a None
  check, so a valid token for a deleted account is a 500. Pre-existing,
  unrelated to caching, and untouched.
- The cache client is bound to the event loop that first uses it, which is
  fine under uvicorn's single loop but will surprise anyone driving the app
  from a second loop in a script.
