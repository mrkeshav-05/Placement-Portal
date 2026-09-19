import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { DashboardFeed, type DashboardFeedData } from "@/components/dashboard/dashboard-feed";
import { backendFetch } from "@/lib/api-client";
import type { BackendAnnouncement, BackendJob } from "@/lib/backend-types";
import { db } from "@/lib/db";
import { evaluateEligibility, isEligible } from "@/lib/eligibility";
import { companyColor, companyInitials, formatPortalDate } from "@/lib/job-presenters";
import { toEligibilityProfile } from "@/lib/student-profile";
import { requireStudent, studentDisplayName } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const student = await requireStudent();
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const userId = student.user?.id;

  const [activeJobs, applications, announcements, resumeCount] = await Promise.all([
    // Both of these come from the API's Redis cache. Neither is filtered by
    // the caller, so every student on the portal shares one cached copy.
    backendFetch<BackendJob[]>("/api/v1/jobs?activeOnly=true"),
    userId
      ? db.application.findMany({ where: { userId }, select: { status: true } })
      : Promise.resolve([]),
    // Drafts belong to the placement cell, and the server enforces that: a
    // student's token only ever draws published rows, so there is no status
    // filter to get wrong here.
    backendFetch<BackendAnnouncement[]>("/api/v1/announcements?limit=20"),
    userId ? db.resume.count({ where: { userId } }) : Promise.resolve(0),
  ]);

  // The endpoint deliberately does not filter on "closes after now": a clock
  // in the cache key would expire an entry the moment it was written. The
  // cheap half of that filter happens here instead.
  const jobs = activeJobs
    .map((job) => ({ ...job, registrationDeadline: new Date(job.registrationDeadline) }))
    .filter((job) => job.registrationDeadline >= now);

  const eligibilityProfile = student.user
    ? toEligibilityProfile(student.user, resumeCount)
    : null;
  const eligibleRoles = eligibilityProfile
    ? jobs.filter((job) =>
        isEligible(
          evaluateEligibility(eligibilityProfile, {
            minCgpa: job.minCGPA,
            batch: job.batch,
            branches: job.allowedBranches,
            degrees: job.allowedDegrees,
            genders: job.allowedGenders,
            maxBacklogs: job.maxBacklogs,
            maxBans: job.maxBans,
          }),
        ),
      ).length
    : null;

  const data: DashboardFeedData = {
    studentName: studentDisplayName(student),
    dateLabel: new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(now),
    metrics: {
      openOpportunities: jobs.length,
      closingThisWeek: jobs.filter(
        (job) => job.registrationDeadline <= weekFromNow,
      ).length,
      applications: applications.length,
      underReview: applications.filter((application) =>
        ["SHORTLISTED", "INTERVIEW"].includes(application.status),
      ).length,
      eligibleRoles,
    },
    nextDeadline: jobs[0]
      ? {
          company: jobs[0].company?.name ?? "Company not recorded",
          date: formatPortalDate(jobs[0].registrationDeadline, true),
        }
      : null,
    announcements: announcements.map((announcement) => {
      const companyName = announcement.company?.name ?? "Placement Cell";
      return {
        id: announcement.id,
        company: companyName,
        title: announcement.title,
        summary: announcement.content,
        date: formatPortalDate(announcement.createdAt),
        type:
          announcement.tags[0] ??
          (announcement.category === "COMPANY_EVENT" ? "Company event" : "Update"),
        category:
          announcement.category === "COMPANY_EVENT" ? "Company event" : "General",
        tags: announcement.tags || [],
        attachments: announcement.attachments.map((file) => ({
          fileName: file.fileName,
          fileUrl: file.fileUrl,
        })),
        color: companyColor(companyName),
        initial: companyInitials(companyName),
      };
    }),
  };

  return (
    <AuthenticatedPortalShell>
      <DashboardFeed data={data} />
    </AuthenticatedPortalShell>
  );
}
