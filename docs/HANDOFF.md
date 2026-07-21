# Team Handoff

This file carries short-lived working context between teammates and agents. Canonical architecture belongs in `PROJECT_CONTEXT.md`; durable decisions belong in `DECISIONS.md`.

## Current state

- Active objective: implement persistent announcement publishing and administrator application review
- Active owner: unassigned
- Branch: main working tree contains the authenticated student persistence phase
- Last verified: Google Workspace OAuth, external admin allowlist/database synchronization, PostgreSQL connectivity, persistent student directory/profile inspection, profile edit-mode fix, persistent job publishing, lint, type-check, 15 unit tests, production build, and authenticated browser smoke tests for the admin student directory/detail and job-profile page
- External blocker: resume/document storage provider has not been selected

## Known next work

1. Add persistent announcement publishing.
2. Add administrator application review and status updates.
3. Add encrypted Aadhaar/PAN profile actions using the existing encryption helper.
4. Select storage and implement PDF-only resume upload/ownership/default selection.
5. Persist NOC workflows and the remaining admin modules.

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
