import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { JobsList, type StudentJobListItem } from "@/components/jobs/jobs-list";
import { backendFetch } from "@/lib/api-client";
import { requireStudent } from "@/lib/student-session";
import type { BackendJob } from "@/lib/backend-types";
import { companyColor, companyInitials, formatPortalDate, jobStatusLabel, jobTypeLabel } from "@/lib/job-presenters";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Served from the API's Redis cache rather than queried here. The endpoint
  // returns ACTIVE and ENDED drives, soonest deadline first, which is the set
  // and the order this page used to ask Prisma for.
  const [fetched, student] = await Promise.all([
    backendFetch<BackendJob[]>("/api/v1/jobs"),
    requireStudent(),
  ]);
  // Newest added first. The API keeps deadline order because the dashboard's
  // "next deadline" depends on it, so this screen re-sorts for itself.
  const jobs = [...fetched].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const items: StudentJobListItem[] = jobs.map((job) => {
    const company = job.company?.name ?? "Company not recorded";
    return {
      id: job.id,
      company,
      initials: companyInitials(company),
      color: companyColor(company),
      title: job.title,
      batch: job.batch,
      type: jobTypeLabel(job.type),
      location: job.locations.join(" / ") || "Location not specified",
      deadline: formatPortalDate(job.registrationDeadline, true),
      deadlineAt: String(job.registrationDeadline),
      status: jobStatusLabel(job.status) as "Active" | "Closed",
    };
  });

  return (
    <AuthenticatedPortalShell>
      <JobsList jobs={items} studentBatch={student.user.batch} />
    </AuthenticatedPortalShell>
  );
}
