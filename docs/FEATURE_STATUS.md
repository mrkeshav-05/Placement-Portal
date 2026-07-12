# Feature Status

Use `Persistent`, `Partial`, `Local`, or `Planned`. Update this file in the same pull request that changes a status.

| Module | Status | Current boundary | Next backend step |
|---|---|---|---|
| Authentication/RBAC | Partial | Google and dev credentials configured; route guards implemented | Validate real Workspace OAuth and production cookies |
| Database/schema | Persistent | Initial Prisma migration and seed exist | Add migrations with each schema change |
| Dashboard | Local | Search/filter UI and demonstration metrics | Query announcements, deadlines, eligibility, and application counts |
| Company Events | Local | Search/filter/detail and test eligibility UI | Query JobProfile/Company and use shared eligibility helper |
| Apply flow | Local | Button state only | Add authorized transaction creating unique Application with resume selection |
| Applications | Local | Filters, timeline, withdrawal UI | Query user applications and add guarded withdrawal action |
| Profile | Local | Editable form, document and resume presentation | Add Zod server action, encryption, upload storage, and Prisma writes |
| Feedback | Local | Submission and response presentation | Add authenticated create/list actions and admin response flow |
| Forms/NOC | Local | Tabs, request modal, local list | Add create/list/cancel actions and admin approval/document storage |
| Contact/Team | Local | Public directory presentation | Read TeamMember records managed by admin |
| Admin dashboard | Local | Demonstration analytics | Add aggregate Prisma queries |
| Admin management | Local | Search, modal, edit/delete presentation | Replace generic local manager with entity-specific guarded server actions |
| File uploads | Planned | UI affordances only | Choose S3/Cloudinary, validate PDF/size/ownership |
| Email/notifications | Planned | Notification schema exists | Configure Resend and event-driven messages |
| Encryption | Persistent utility | AES-256-GCM helper and tests exist | Integrate helper into profile server actions |
| CI/Docker | Persistent | CI workflow, Dockerfile, Compose, health route | Add deployment target and production secrets |
