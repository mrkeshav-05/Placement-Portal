import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { PlacementRecordsBulkForm } from "@/components/admin/placement-records-bulk-form";
import type {
  CompanyOption,
  JobOption,
} from "@/components/admin/placement-records-manager";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { PERM_PLACEMENT_RECORDS_CREATE } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type OptionsResponse = {
  companies: CompanyOption[];
  jobs: JobOption[];
};

export default async function Page() {
  await requirePermission(PERM_PLACEMENT_RECORDS_CREATE);

  // The roster is not loaded here: students are named by roll number, and the
  // backend resolves them. A season's paste is forty names out of hundreds.
  let options: OptionsResponse = { companies: [], jobs: [] };
  let backendError: string | null = null;

  try {
    options = await backendFetch<OptionsResponse>("/api/v1/offers/options", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to load placement record options from the backend", error);
    backendError = "Companies and drives could not be loaded. The API service is unreachable.";
  }

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Placement records</span>
            <h1>Add records</h1>
            <p>
              Record one drive&apos;s outcome for a list of students: set the season, company,
              and package once, then paste the roll numbers.
            </p>
          </div>
        </section>

        <PlacementRecordsBulkForm
          companies={options.companies}
          jobs={options.jobs}
          backendError={backendError}
        />
      </div>
    </AuthenticatedAdminShell>
  );
}
