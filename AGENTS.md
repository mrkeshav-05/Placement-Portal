# Agent Operating Guide

This file applies to the entire repository. Every coding agent must read this file and `docs/PROJECT_CONTEXT.md` before planning or editing. The repository is the shared memory; chat history is not authoritative.

## Source-of-truth order

When sources disagree, use this order:

1. Current code, Prisma schema, tests, and configuration
2. `docs/PROJECT_CONTEXT.md`
3. `docs/DECISIONS.md`
4. `docs/FEATURE_STATUS.md`
5. `IMPLEMENTATION_PLAN.md` (historical product plan; some choices have evolved)

Never silently change an established architectural decision. Record intentional changes in `docs/DECISIONS.md` and update the project context in the same change.

## Required workflow

1. Inspect `git status` and preserve unrelated or user-owned changes.
2. Read the files relevant to the module before editing.
3. Make the smallest coherent change that completes the requested behavior.
4. Validate external input with Zod at server boundaries.
5. Enforce authentication and authorization on the server, not only in the UI.
6. Add or update tests for reusable business logic.
7. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build` before handing off a substantial change.
8. Update `docs/FEATURE_STATUS.md` when a feature moves between mock, partial, and persistent states.
9. Update `docs/HANDOFF.md` before handing unfinished work to another contributor or agent.

## Non-negotiable constraints

- Framework: Next.js App Router, React, and strict TypeScript.
- Database: PostgreSQL through Prisma. Do not add a second ORM or database layer.
- Authentication: Auth.js. Student access is restricted to `@iiitl.ac.in`; admin routes require `ADMIN`.
- Development credentials must remain unavailable in production.
- Sensitive identity values must use the AES-256-GCM helpers in `src/lib/encryption.ts`; never log or return raw Aadhaar/PAN values.
- Resume uploads must be PDF-only, size-limited, and authorized by user ownership when persistence is added.
- Keep secrets in `.env`; never commit, print, or copy real secrets into documentation.
- Use the established navy/orange design tokens and existing responsive shells.
- Prefer shared components and `src/lib` business functions over duplicating logic inside pages.
- Do not describe local component state as database persistence.

## Project commands

```bash
npm install
docker compose up -d db
npx prisma migrate dev
npm run db:seed
npm run dev
```

Verification:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

## Change boundaries

- Student UI belongs under `src/app` student routes and `src/components` feature folders.
- Admin UI belongs under `src/app/admin` and `src/components/admin`.
- Reusable rules such as eligibility and encryption belong under `src/lib` with unit tests.
- Schema changes require a Prisma migration and an update to seed data when relevant.
- New environment variables must be documented in `.env.example` and `README.md` without real values.

## Definition of done

A change is done only when behavior, authorization, validation, empty/error/loading states, responsive layout, tests, and documentation are consistent. If credentials or an external service prevent full verification, state the exact unverified boundary in the handoff.
