import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { PpoWorklist, type PpoInternship } from "@/components/admin/ppo-worklist";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { PERM_PLACEMENT_RECORDS_UPDATE } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// The backend caps a page at 500 offers. Internships are a fraction of those
// per season, but the cap is why the screen says so when it is reached.
const LIMIT = 500;

export default async function Page() {
  await requirePermission(PERM_PLACEMENT_RECORDS_UPDATE);

  let internships: PpoInternship[] = [];
  let backendError: string | null = null;

  try {
    const offers = await backendFetch<Array<PpoInternship & { status: string }>>(
      `/api/v1/offers?type=INTERNSHIP&limit=${LIMIT}`,
      { cache: "no-store" },
    );
    // A declined or revoked internship holds nobody back, so there is no
    // outcome to record for it.
    internships = offers.filter((offer) => offer.status === "OFFERED" || offer.status === "ACCEPTED");
  } catch (error) {
    console.error("Failed to load internships from the backend", error);
    backendError = "Internships could not be loaded. The API service is unreachable.";
  }

  return (
    <AuthenticatedAdminShell>
      <PpoWorklist internships={internships} backendError={backendError} truncated={internships.length >= LIMIT} />
    </AuthenticatedAdminShell>
  );
}
