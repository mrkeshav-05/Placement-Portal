# Contributing

## Before coding

1. Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, and `docs/FEATURE_STATUS.md`.
2. Pull the latest integration branch and inspect `git status`.
3. Create a focused branch such as `feature/profile-persistence` or `fix/admin-authorization`.
4. State which feature-status boundary the change will move.

## Pull requests

- Keep one coherent concern per pull request.
- Explain behavior and data/security implications, not only files changed.
- Include screenshots for desktop and mobile UI changes.
- Include a Prisma migration for schema changes.
- Never commit `.env`, access tokens, real student PII, or uploaded documents.
- Update central context when changing architecture, workflows, environment variables, or feature status.

## Required checks

```bash
npm run lint
npm run type-check
npm test
npm run build
```

Reviewers should verify server-side authorization, validation, ownership checks, responsive behavior, and that the implementation does not introduce a second source of truth.
