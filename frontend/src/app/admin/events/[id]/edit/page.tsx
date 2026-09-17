import { notFound } from "next/navigation";
import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { EventForm, type EventFormValues } from "@/components/admin/event-form";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { loadEventFormOptions } from "@/lib/event-options";
import { PERM_JOBS_UPDATE } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERM_JOBS_UPDATE);
  const { id } = await params;

  const event = await db.jobProfile.findUnique({ where: { id } });
  if (!event) notFound();

  const { companies, degrees, branchGroups } = await loadEventFormOptions(
    event.allowedDegrees,
    event.allowedBranches,
  );

  const values: EventFormValues = {
    id: event.id,
    companyId: event.companyId,
    title: event.title,
    type: event.type,
    jobCategory: event.jobCategory,
    batch: event.batch,
    placementYear: event.placementYear,
    registrationDeadline: event.registrationDeadline.toISOString(),
    status: event.status,
    minCGPA: event.minCGPA,
    maxBacklogs: event.maxBacklogs,
    maxBans: event.maxBans,
    allowedDegrees: event.allowedDegrees,
    allowedBranches: event.allowedBranches,
    allowedGenders: event.allowedGenders,
    locations: event.locations,
    ctcStipend: event.ctcStipend,
    ctcStipendInfo: event.ctcStipendInfo,
    description: event.description,
    openingOverview: event.openingOverview,
    cap: event.cap,
    companyBond: event.companyBond,
    duration: event.duration,
    redirectUrl: event.redirectUrl,
  };

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Opportunity management</span>
            <h1>Edit Company Event</h1>
            <p>
              Changes reach students as soon as they are saved on an active event.
            </p>
          </div>
        </section>
        <EventForm
          companies={companies}
          degrees={degrees}
          branchGroups={branchGroups}
          event={values}
        />
      </div>
    </AuthenticatedAdminShell>
  );
}
