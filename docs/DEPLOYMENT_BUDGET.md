# AWS vs GCP Deployment Budget — Placement Portal (~1,000 students)

This is a cost estimate, not a code change. All figures are sourced from live pricing pages/aggregators (September 2026) for the `ap-south-1` (Mumbai) / `asia-south1` (Mumbai) regions, since the institute is India-based. Treat every number as an estimate — actual AWS/GCP bills include taxes, egress, and rounding not fully captured here.

## What the current code actually needs to run (grounded in this repo)

Four services per [`docker-compose.yml`](../docker-compose.yml): Postgres 16, Redis 7 (`--maxmemory 256mb`, no persistence — a restart is just a cold cache, per its own comment), the FastAPI `backend`, and the Next.js `frontend`. Plus a one-shot `migrate` job.

File storage facts that drive the storage line item, verified in code:

- Resumes: up to `max_resumes_per_student = 5` per student, each capped at `allowed_pdf_size_mb = 5` MB ([`backend/app/core/config.py`](../backend/app/core/config.py)).
- NOC documents: one signed PDF per NOC request, same 5MB cap ([`backend/app/routers/noc.py`](../backend/app/routers/noc.py)).
- **Identity documents (Aadhaar, PAN, College ID) always write to local disk** via `LOCAL_UPLOADS_DIR`, regardless of whether Cloudinary is configured — [`backend/app/routers/profile.py`](../backend/app/routers/profile.py) never calls the Cloudinary path for these three. Only resumes/NOC docs/announcement attachments go through [`backend/app/core/storage.py`](../backend/app/core/storage.py)'s Cloudinary-then-local-fallback logic.
- Cloudinary is currently unconfigured in `.env` (empty keys), so **everything** presently falls back to local disk.
- **Pre-existing gap**: `docker-compose.yml` declares only a `postgres_data` volume — no volume for uploads. In the shipped compose file, uploaded files are not persisted across a container rebuild, and the `frontend` and `backend` containers (both of which read/write `UPLOADS_DIR`) do not share a filesystem. This is a real gap independent of which cloud you pick; see the recommendation below.

### Realistic storage sizing at ~1,000 students

- Resumes: ~1.5 uploaded/student on average (not the 5-max) × ~0.7MB ≈ **~1 GB**
- Identity docs: assume ~60% of students upload all three × ~0.5MB each ≈ **~0.5 GB**
- NOC documents: ~25% of students file 1–2 requests × ~1MB ≈ **~0.4 GB**
- Announcement attachments (admin-only): ~150/year × ~1.5MB ≈ **~0.2 GB/year**
- **Realistic Year 1 total: ~3–5 GB**, growing a few GB/year (no retention/cleanup policy exists in the code today).
- **Worst-case ceiling** if every student maxed every upload slot (5 resumes + 3 identity docs + several NOC docs, all at 5MB): **~45–50 GB**. Use this only as a safety margin, not a planning number.

Database size itself (rows, not files) for 1,000 students across users/applications/offers/NOC/announcements is well under 1 GB — the real constraint is the *minimum billable* provisioned tier, not actual usage.

## Recommendation before deploying (not costed, since it's a code change)

Migrate Aadhaar/PAN/College-ID storage to the same Cloudinary-or-object-storage path resumes already use, and add a real uploads volume to the compose file. This closes the no-shared-volume gap above and, as shown below, is also the difference between near-zero storage cost and a disproportionately expensive minimum-capacity tier (Filestore/EFS) on both clouds. This is a follow-up engineering task, not part of this cost estimate.

## Domain

- **$0/year** if hosted as a subdomain of the institute's existing `iiitl.ac.in` (e.g. `placements.iiitl.ac.in`) — just a DNS record, no new registration. This is the realistic assumption used below.
- If a new domain is wanted instead: `.in` ≈ ₹550–750/yr (~$7–9), `.com` ≈ ₹1,200–1,550/yr (~$14–19), a restricted `.ac.in` (subject to eligibility) ≈ ₹1,180/yr (~$14) via ERNET India.

## Email (Resend — already wired into the backend)

- Free plan: 3,000 emails/month, but capped at **100/day**. A ~1,000-student registration window (OTP codes, password resets, confirmations) will very likely blow through 100/day during the first couple of weeks of onboarding, even though yearly volume is easily within 3,000/month off-season.
- **Pro plan: $20/month for 50,000 emails/month, no daily cap.** Recommended for at least the registration/placement-drive months; Resend bills month-to-month, so you can downgrade to Free in quiet months if you want to shave this to near-$0 for 8–10 months/year.
- Estimated annual cost: **$20–240/year** depending on whether you keep Pro active year-round ($240) or only during 1–2 active months ($20–40).

## Three deployment styles, each costed for AWS (ap-south-1) and GCP (asia-south1)

### Tier A — Cheapest self-managed (one VM running the existing docker-compose stack as-is)

This is the least-code-change option: it's literally the shipped `docker-compose.yml` on one box, plus a small attached disk for uploads.

**AWS**

- Compute: `t4g.small` (2 vCPU/2GB) ≈ $8.18/mo on-demand — genuinely tight running Postgres+Redis+Next.js+FastAPI together; `t4g.medium` (4GB) ≈ $16–17/mo is the safer real-world minimum.
- Storage: 30GB gp3 EBS ≈ $2.40/mo.
- **Total: ~$11–19/month (~$130–230/year)**, plus domain/email above.

**GCP**

- Compute: `e2-small` (2 vCPU/2GB) ≈ $12.22/mo; `e2-medium` (4GB) ≈ $24/mo for the safer option.
- Storage: 30GB pd-balanced ≈ $2.40/mo.
- **Total: ~$15–26/month (~$180–320/year)**, plus domain/email.

No managed DB/Redis/HA here — single point of failure, manual backups, but this matches the project's current architecture exactly and needs zero code changes.

### Tier B — Fully managed services (managed Postgres, managed Redis, managed containers)

**AWS**

- Fargate (backend + frontend, ~1 vCPU / 2GB combined, always-on): ≈ $36/mo (using the published $0.04048/vCPU-hr, $0.004445/GB-hr rate; Mumbai-specific Fargate rate wasn't published in the sources checked — treat as approximate).
- RDS `db.t4g.micro` Postgres (Mumbai): ≈ $15/mo + ~20GB storage ≈ $2/mo.
- ElastiCache `cache.t4g.micro` Redis: ≈ $12/mo — for a cache capped at 256MB by the app's own config, this is already the smallest available managed node.
- Storage: Cloudinary free tier ($0, 25GB-equivalent credits) for resumes/NOC/attachments; identity docs need EFS if kept on local-disk semantics, ≈ $1.50–5/mo for <5GB (EFS has per-GB and throughput charges beyond raw storage).
- **Total: ~$67–77/month (~$800–920/year)**

**GCP**

- Compute: Cloud Run's "instance-based" (always-on) billing is *more* expensive per vCPU than Fargate at 24/7 utilization (~$47/mo per vCPU vs Fargate's ~$30). For an always-on managed-container equivalent, a small Compute Engine VM (`e2-small`/`e2-medium`, ~$12–24/mo) is the practical choice instead.
- Cloud SQL `db-f1-micro` Postgres (Mumbai): ≈ $9/mo + ~20GB SSD storage ≈ $3.50/mo.
- Memorystore Redis Basic M1 (1GB minimum): ≈ $36/mo — **disproportionate** for a 256MB cache; a third-party like Upstash (pay-as-you-go, ~$0–10/mo) or just self-hosting Redis in the same VM is a better fit even in a "managed" setup on GCP.
- Storage: Cloudinary free tier ($0) for resumes/NOC/attachments; **Filestore's minimum provisionable capacity is 1 TiB** (Basic HDD ≈ $164/mo minimum) — wildly disproportionate for <5GB of identity docs. A persistent disk on a small VM (a few dollars) is the only sane option unless identity-doc storage is migrated to GCS directly.
- **Total (practical version — VM + Cloud SQL + Upstash Redis + persistent disk): ~$25–40/month (~$300–480/year)**
- **Total (literal "fully managed everything" version with Memorystore + Filestore): ~$210+/month** — included only to show why this combination doesn't make sense at this scale.

### Tier C — Serverless/autoscaling (fits this app's seasonal placement-drive traffic best)

**GCP Cloud Run** (request-based billing, `min-instances=0`) is the standout option here: it genuinely scales to zero. Idle months (most of the year) cost close to $0 in compute — the free tier alone (2M requests, 180,000 vCPU-sec, 360,000 GiB-sec/month) likely covers most traffic for a portal this size. During an active placement-drive week, expect maybe $10–30 for that month. Managed DB/Redis costs are the same as Tier B (~$45–50/mo with the Upstash-instead-of-Memorystore substitution). **Estimated: ~$50–80/month during active months, ~$45–55/month idle (~$650–850/year).**

**AWS**'s nearest equivalent (Fargate with scheduled scaling, or App Runner) doesn't scale to true zero as naturally — there's always at least one running task unless you deliberately stop it off-season. Same DB/Redis floor as Tier B (~$27/mo). **Estimated: ~$55–65/month during active months if left running, or as low as the DB/Redis floor (~$27/mo) if you manually pause compute during the 8+ idle months.**

## Bottom-line summary (compute + DB + cache + storage, excluding domain/email)

- **Tier A (cheapest self-managed)**: AWS ~$130–230/yr · GCP ~$180–320/yr — matches current architecture with zero code changes.
- **Tier B (fully managed, practical substitutions)**: AWS ~$800–920/yr · GCP ~$300–480/yr — GCP wins here mainly because avoiding Memorystore/Filestore's oversized minimums matters more than the raw compute-service comparison.
- **Tier C (serverless, seasonal-traffic-aware)**: GCP ~$650–850/yr if left running all year, likely less if truly scaled to zero off-season · AWS comparable if manually paused, otherwise closer to Tier B.
- **Add on top of any tier**: domain $0–19/yr (subdomain vs new domain), email $20–240/yr (Resend Pro during active months vs year-round).

**Overall realistic range for this project at ~1,000 students: roughly $150–350/year on Tier A (recommended starting point — it's the current architecture, unmodified), up to $900–1,200/year if you want managed HA services from day one.**

## Caveats

- Fargate/Cloud Run rates above use the closest published rate where Mumbai/asia-south1-specific figures weren't directly surfaced by search; get an exact AWS/GCP Pricing Calculator quote before committing budget.
- None of this includes data-transfer/egress, which is typically minor for a low-traffic college portal but not zero.
- These numbers assume the storage/volume gap noted above gets fixed before going live; if it doesn't, Tier A's "it just works" advantage disappears since files still won't persist correctly across restarts even with a volume unless `frontend` and `backend` are pointed at the same mount.
