# Feature Status

Use `Persistent`, `Partial`, `Local`, or `Planned`. Update this file in the same pull request that changes a status.

| Module | Status | Current boundary | Next backend step |
|---|---|---|---|
| Authentication/RBAC | Partial | Real Workspace Google OAuth verified locally; dev credentials and role guards implemented | Verify production callback/cookies and deployment secrets |
| Database/schema | Persistent | Initial Prisma migration and seed exist | Add migrations with each schema change |
| Dashboard | Persistent | Authenticated metrics, deadlines, announcements, and eligibility use Prisma records | Add notification read state and richer deadline navigation |
| Company Events | Persistent | Admin-published jobs and per-student eligibility use Prisma and shared rules | Add attachments and selected-resume association |
| Apply flow | Partial | Authorized eligibility recheck and unique Application creation persist | Store the selected/default resume on each application |
| Applications | Persistent | User-owned applications, status timeline, and guarded withdrawal persist | Add status history and interview scheduling details |
| Profile | Partial | Authenticated identity and core profile fields read/write through Zod and Prisma | Add encrypted Aadhaar/PAN entry and authorized PDF resume storage |
| Feedback | Partial | Authenticated create/list and admin response display use Prisma | Add entity-specific admin response action and notifications |
| Forms/NOC | Local | Tabs, request modal, local list | Add create/list/cancel actions and admin approval/document storage |
| Contact/Team | Local | Public directory presentation | Read TeamMember records managed by admin |
| Admin dashboard | Persistent | Live Prisma totals, application funnel, branch placement, and recent applications | Add date/cohort filters and report export |
| Admin companies | Persistent | Authorized create, edit, list, search, and guarded delete use Prisma | Add logo upload and recruiter contacts |
| Admin job profiles | Persistent | Authorized create, edit, list, status filtering, publish/end, and guarded delete use Prisma | Add attachments and coordinators |
| Admin students | Persistent | Authorized searchable directory and read-only profile/application detail use Prisma | Add cohort filters and export |
| Remaining admin management | Planned | Honest implementation states with no fake records | Add entity-specific guarded server actions, starting with announcements and applications |
| File uploads | Planned | UI affordances only | Choose S3/Cloudinary, validate PDF/size/ownership |
| Email/notifications | Planned | Notification schema exists | Configure Resend and event-driven messages |
| Encryption | Persistent utility | AES-256-GCM helper and tests exist | Integrate helper into profile server actions |
| CI/Docker | Persistent | CI workflow, Dockerfile, Compose, health route | Add deployment target and production secrets |
