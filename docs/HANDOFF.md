# Team Handoff

This file carries short-lived working context between teammates and agents. Canonical architecture belongs in `PROJECT_CONTEXT.md`; durable decisions belong in `DECISIONS.md`.

## Current state

- Active objective: none recorded
- Active owner: unassigned
- Branch: repository has not yet established the documented team branch workflow
- Last verified: lint, type-check, unit tests, production build, local student/admin login, PostgreSQL migration, and health endpoint were verified during initial implementation
- External blocker: Google OAuth client ID is not configured

## Known next work

1. Replace local dashboard data with Prisma queries.
2. Persist student profiles with Zod validation and encrypted Aadhaar/PAN fields.
3. Implement authorized resume storage and ownership checks.
4. Persist applications and withdrawals as server-side transactions.
5. Replace generic local admin management with entity-specific server actions.

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
