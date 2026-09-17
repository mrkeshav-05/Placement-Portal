import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { EventsManager, type AdminEventItem } from "@/components/admin/events-manager";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import {
  hasPermission,
  PERM_JOBS_CREATE,
  PERM_JOBS_DELETE,
  PERM_JOBS_UPDATE,
  PERM_JOBS_VIEW,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user } = await requirePermission(PERM_JOBS_VIEW);
  const events = await db.jobProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { company: { select: { name: true } }, _count: { select: { applications: true } } },
  });

  const items: AdminEventItem[] = events.map((event) => ({
    id: event.id,
    companyName: event.company.name,
    title: event.title,
    type: event.type,
    locations: event.locations,
    minCGPA: event.minCGPA,
    allowedBranches: event.allowedBranches,
    batch: event.batch,
    placementYear: event.placementYear,
    registrationDeadline: event.registrationDeadline.toISOString(),
    status: event.status,
    applicationCount: event._count.applications,
  }));

  // hasPermission already answers for the bootstrap allowlist and
  // SUPER_ADMIN, so the row actions match what the actions will accept.
  const subject = { ...user, email: user.email };

  return (
    <AuthenticatedAdminShell>
      <EventsManager
        events={items}
        canCreate={hasPermission(subject, PERM_JOBS_CREATE)}
        canUpdate={hasPermission(subject, PERM_JOBS_UPDATE)}
        canDelete={hasPermission(subject, PERM_JOBS_DELETE)}
      />
    </AuthenticatedAdminShell>
  );
}
