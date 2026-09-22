import { notFound } from "next/navigation";
import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { StudentProfileDetail, type AdminStudentDetail } from "@/components/admin/student-profile-detail";
import { requireAdmin } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { formatPortalDate } from "@/lib/job-presenters";
import { hasPermission, PERM_STUDENTS_UPDATE } from "@/lib/permissions";
import { calculateProfileCompletion } from "@/lib/student-profile";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await params;
  const student = await db.user.findFirst({
    where: { id, role: "STUDENT" },
    include: {
      resumes: { orderBy: { uploadedAt: "desc" } },
      applications: { orderBy: { appliedAt: "desc" }, include: { jobProfile: { include: { company: true } } } },
      offers: { orderBy: { offeredAt: "desc" }, include: { company: true, jobProfile: true } },
      nocRequests: {
        // FACULTY is restricted to APPROVED-only NOC visibility everywhere else
        // in the portal (backend/app/routers/noc.py's list_admin_nocs, and the
        // Prisma fallback in admin/noc-requests/page.tsx) — mirrored here so
        // this page doesn't become a new way for FACULTY to see PENDING/
        // REJECTED requests they're barred from seeing on the dedicated page.
        where: user.role === "FACULTY" ? { status: "APPROVED" } : undefined,
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student) notFound();
  const detail: AdminStudentDetail = {
    id: student.id,
    name: student.name ?? "Student",
    email: student.email ?? "No email",
    rollNumber: student.rollNumber,
    personalEmail: student.personalEmail,
    contactNumber: student.contactNumber,
    altContactNumber: student.altContactNumber,
    branch: student.branch,
    batch: student.batch,
    degree: student.degree,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth ? formatPortalDate(student.dateOfBirth) : null,
    bloodGroup: student.bloodGroup,
    currentAddress: student.currentAddress,
    class10Percent: student.class10Percent,
    class12Percent: student.class12Percent,
    cgpa: student.cgpa,
    backlogs: student.backlogs,
    bans: student.bans,
    profileCompletion: calculateProfileCompletion(student),
    aadhaarProvided: Boolean(student.aadhaarEncrypted),
    panProvided: Boolean(student.panCardEncrypted),
    resumes: student.resumes.map((resume) => ({ id: resume.id, label: resume.label, fileName: resume.fileName, uploadedAt: formatPortalDate(resume.uploadedAt) })),
    applications: student.applications.map((application) => ({ id: application.id, company: application.jobProfile.company.name, role: application.jobProfile.title, status: application.status, appliedAt: formatPortalDate(application.appliedAt) })),
    offers: student.offers.map((offer) => ({
      id: offer.id,
      company: offer.company.name,
      jobTitle: offer.jobProfile?.title ?? null,
      type: offer.type,
      status: offer.status,
      ctc: offer.ctc,
      stipend: offer.stipend,
      offeredAt: formatPortalDate(offer.offeredAt),
    })),
    nocRequests: student.nocRequests.map((noc) => ({
      id: noc.id,
      company: noc.company,
      source: noc.source,
      status: noc.status,
      nocRequired: noc.nocRequired,
      startDate: formatPortalDate(noc.startDate),
      endDate: formatPortalDate(noc.endDate),
    })),
  };
  return (
    <AuthenticatedAdminShell>
      <StudentProfileDetail student={detail} canUpdateAcademic={hasPermission(user, PERM_STUDENTS_UPDATE)} />
    </AuthenticatedAdminShell>
  );
}
