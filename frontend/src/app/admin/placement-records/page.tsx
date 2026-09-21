import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import {
  PlacementRecordsManager,
  type CompanyOption,
  type JobOption,
  type OfferRecord,
  type StudentOption,
} from "@/components/admin/placement-records-manager";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import {
  hasPermission,
  PERM_PLACEMENT_RECORDS_CREATE,
  PERM_PLACEMENT_RECORDS_DELETE,
  PERM_PLACEMENT_RECORDS_UPDATE,
  PERM_PLACEMENT_RECORDS_VIEW,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

type OptionsResponse = {
  students: StudentOption[];
  companies: CompanyOption[];
  jobs: JobOption[];
};

export default async function Page() {
  const { user } = await requirePermission(PERM_PLACEMENT_RECORDS_VIEW);
  // Add/Edit/Delete are separate grants (placement_records.create/update/
  // delete) from the view grant that gets someone onto this page at all —
  // PLACEMENT_VOLUNTEER and now FACULTY hold only the view grant, so the
  // controls for each action must be hidden unless the specific permission
  // behind it is held, not just shown because the page loaded.
  const canCreate = hasPermission(user, PERM_PLACEMENT_RECORDS_CREATE);
  const canUpdate = hasPermission(user, PERM_PLACEMENT_RECORDS_UPDATE);
  const canDelete = hasPermission(user, PERM_PLACEMENT_RECORDS_DELETE);

  // Offers live only in the backend, so an unreachable API is an empty screen
  // with an explanation rather than a half-populated one.
  let offers: OfferRecord[] = [];
  let options: OptionsResponse = { students: [], companies: [], jobs: [] };
  let backendError: string | null = null;

  try {
    [offers, options] = await Promise.all([
      backendFetch<OfferRecord[]>("/api/v1/offers?limit=500", { cache: "no-store" }),
      backendFetch<OptionsResponse>("/api/v1/offers/options", { cache: "no-store" }),
    ]);
  } catch (error) {
    console.error("Failed to load placement records from the backend", error);
    backendError = "Placement records could not be loaded. The API service is unreachable.";
  }

  return (
    <AuthenticatedAdminShell>
      <PlacementRecordsManager
        offers={offers}
        students={options.students}
        companies={options.companies}
        jobs={options.jobs}
        backendError={backendError}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </AuthenticatedAdminShell>
  );
}
