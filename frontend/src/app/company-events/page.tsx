import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { JobsList, type StudentJobListItem } from "@/components/jobs/jobs-list";
import { backendFetch } from "@/lib/api-client";
import type { BackendJob } from "@/lib/backend-types";
import { companyColor, companyInitials, formatPortalDate, jobStatusLabel, jobTypeLabel } from "@/lib/job-presenters";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Served from the API's Redis cache rather than queried here. The endpoint
  // returns ACTIVE and ENDED drives, soonest deadline first, which is the set
  // and the order this page used to ask Prisma for.
  const jobs = await backendFetch<BackendJob[]>("/api/v1/jobs");

  const items: StudentJobListItem[] = jobs.map((job) => {
    const company = job.company?.name ?? "Company not recorded";
    return {
      id: job.id,
      company,
      initials: companyInitials(company),
      color: companyColor(company),
      title: job.title,
      type: jobTypeLabel(job.type),
      location: job.locations.join(" / ") || "Location not specified",
      deadline: formatPortalDate(job.registrationDeadline, true),
      status: jobStatusLabel(job.status) as "Active" | "Closed",
    };
  });

  return (
    <AuthenticatedPortalShell>
      <JobsList jobs={items} />
    </AuthenticatedPortalShell>
  );
}
