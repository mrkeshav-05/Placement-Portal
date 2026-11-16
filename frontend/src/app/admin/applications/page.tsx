import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { RegistrationsPage, type RegistrationsTab } from "@/components/admin/registrations/registrations-page";
import type { AdminApplicationRow, JobOption } from "@/components/admin/registrations/types";
import { adminHasPermission, requireAdmin } from "@/lib/admin-session";
import { backendFetch } from "@/lib/api-client";
import { db } from "@/lib/db";
import { formatPortalDate } from "@/lib/job-presenters";
import { PERM_APPLICATIONS_UPDATE } from "@/lib/permissions";
import type { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/** The API's own ceiling for one page of applications. */
const APPLICATION_LIMIT = 1000;

type BackendAdminAppItem = Omit<AdminApplicationRow, "appliedAt" | "appliedAtIso" | "updatedAt" | "status"> & {
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; tab?: string }>;
}) {
  await requireAdmin();
  const { event, tab } = await searchParams;

  const [jobs, canUpdate] = await Promise.all([
    db.jobProfile.findMany({ orderBy: { createdAt: "desc" }, include: { company: true } }),
    adminHasPermission(PERM_APPLICATIONS_UPDATE),
  ]);

  const jobOptions: JobOption[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    companyId: j.companyId,
    companyName: j.company.name,
    batch: j.batch,
  }));

  // An unknown id in the address falls back to "all events" rather than an empty page.
  const eventId = event && jobOptions.some((job) => job.id === event) ? event : null;

  // Loaded for the chosen event rather than as one global list capped at the
  // most recent applications, so an older event is never shown half empty.
  const query = new URLSearchParams({ limit: String(APPLICATION_LIMIT) });
  if (eventId) query.set("job_id", eventId);

  let rows: AdminApplicationRow[];
  try {
    const backendApps = await backendFetch<BackendAdminAppItem[]>(`/api/v1/applications/admin?${query}`);
    rows = backendApps.map((a) => ({
      ...a,
      appliedAtIso: String(a.appliedAt),
      appliedAt: formatPortalDate(a.appliedAt),
      updatedAt: formatPortalDate(a.updatedAt),
    }));
  } catch (error) {
    // Only an unreachable API falls back to the database. An HTTP error (a
    // missing permission, say) must show, not be answered with unchecked data.
    if (!(error instanceof TypeError)) throw error;
    const prismaApps = await db.application.findMany({
      where: eventId ? { jobProfileId: eventId } : undefined,
      orderBy: { updatedAt: "desc" },
      take: APPLICATION_LIMIT,
      include: { user: true, jobProfile: { include: { company: true } }, resume: true, offer: true },
    });
    rows = prismaApps.map((a) => ({
      id: a.id,
      userId: a.userId,
      studentName: a.user.name || a.user.rollNumber || "Student",
      studentEmail: a.user.email || "",
      rollNumber: a.user.rollNumber,
      branch: a.user.branch,
      batch: a.user.batch,
      degree: a.user.degree,
      cgpa: a.user.cgpa,
      class10Percent: a.user.class10Percent,
      class12Percent: a.user.class12Percent,
      personalEmail: a.user.personalEmail,
      contactNumber: a.user.contactNumber,
      jobProfileId: a.jobProfileId,
      jobTitle: a.jobProfile.title,
      companyId: a.jobProfile.companyId,
      companyName: a.jobProfile.company.name,
      resumeId: a.resumeId,
      resumeUrl: a.resume?.fileUrl || null,
      resumeLabel: a.resume?.label || null,
      status: a.status,
      offerId: a.offer?.id ?? null,
      appliedAtIso: a.appliedAt.toISOString(),
      appliedAt: formatPortalDate(a.appliedAt),
      updatedAt: formatPortalDate(a.updatedAt),
    }));
  }

  const initialTab: RegistrationsTab = tab === "manage" ? "manage" : "registrations";

  return (
    <AuthenticatedAdminShell>
      <RegistrationsPage
        applications={rows}
        jobs={jobOptions}
        eventId={eventId}
        initialTab={initialTab}
        canUpdate={canUpdate}
        truncatedAt={rows.length >= APPLICATION_LIMIT ? APPLICATION_LIMIT : null}
      />
    </AuthenticatedAdminShell>
  );
}
