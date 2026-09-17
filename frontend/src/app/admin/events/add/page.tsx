import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { EventForm } from "@/components/admin/event-form";
import { requirePermission } from "@/lib/admin-session";
import { loadEventFormOptions } from "@/lib/event-options";
import { PERM_JOBS_CREATE } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePermission(PERM_JOBS_CREATE);
  const { companies, degrees, branchGroups } = await loadEventFormOptions();

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Opportunity management</span>
            <h1>Add Company Event</h1>
            <p>Students see an event only once it is active and its deadline is ahead.</p>
          </div>
        </section>
        <EventForm
          companies={companies}
          degrees={degrees}
          branchGroups={branchGroups}
          event={null}
        />
      </div>
    </AuthenticatedAdminShell>
  );
}
