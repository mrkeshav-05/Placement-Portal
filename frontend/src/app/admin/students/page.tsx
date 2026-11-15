import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { StudentsManager, type AdminStudentListItem } from "@/components/admin/students-manager";
import { requireAdmin } from "@/lib/admin-session";
import { backendFetch } from "@/lib/api-client";
import { db } from "@/lib/db";
import { formatRupees } from "@/lib/offer-schema";
import type { Standing } from "@/lib/placement-policy";
import { calculateProfileCompletion } from "@/lib/student-profile";

export const dynamic = "force-dynamic";

type MissedCompanyFlagDto = {
  companyId: string;
  companyName: string;
  jobTitle: string;
  registrationDeadline: string;
};

type StudentApplicationFlagDto = {
  userId: string;
  longestMissedStreak: number;
  totalEligibleCompanies: number;
  totalAppliedCompanies: number;
  missedCompanies: MissedCompanyFlagDto[];
};

type StudentStandingDto = {
  userId: string;
  standing: Standing;
  label: string;
  companyName: string | null;
  ctc: number | null;
};

function standingDetail(dto: StudentStandingDto): string | null {
  const extra = dto.ctc != null ? formatRupees(dto.ctc) : null;
  return [dto.companyName, extra].filter(Boolean).join(" · ") || null;
}

export default async function Page() {
  await requireAdmin();
  const students = await db.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
    // Every registered student, forever, was fetched here unconditionally —
    // cost that grows with every incoming batch rather than with the batch
    // being looked at right now. This bounds it the same way the admin
    // applications endpoint's `limit` does; genuine server-side pagination
    // and search (this page's search box still filters client-side, over
    // whatever this take returns) is the deferred, separately-scoped item.
    take: 1000,
  });

  let flagsByUserId = new Map<string, StudentApplicationFlagDto>();
  try {
    const flags = await backendFetch<StudentApplicationFlagDto[]>("/api/v1/students/admin/flags?min_streak=3");
    flagsByUserId = new Map(flags.map((flag) => [flag.userId, flag]));
  } catch (err) {
    console.error("Failed to fetch student application flags", err);
  }

  // Students holding no counted offer are absent from this list and are OPEN.
  let standingsByUserId = new Map<string, StudentStandingDto>();
  try {
    const standings = await backendFetch<StudentStandingDto[]>("/api/v1/students/admin/standings");
    standingsByUserId = new Map(standings.map((dto) => [dto.userId, dto]));
  } catch (err) {
    console.error("Failed to fetch student placement standings", err);
  }

  const items: AdminStudentListItem[] = students.map((student) => {
    const flag = flagsByUserId.get(student.id);
    return {
      id: student.id,
      name: student.name ?? "Student",
      email: student.email ?? "No email",
      rollNumber: student.rollNumber,
      branch: student.branch,
      batch: student.batch,
      cgpa: student.cgpa,
      completion: calculateProfileCompletion(student),
      applicationCount: student._count.applications,
      missedStreak: flag?.longestMissedStreak ?? 0,
      missedCompanies: flag?.missedCompanies.map((c) => c.companyName) ?? [],
      standing: standingsByUserId.get(student.id)?.standing ?? "OPEN",
      standingDetail: (() => {
        const dto = standingsByUserId.get(student.id);
        return dto ? standingDetail(dto) : null;
      })(),
    };
  });

  return (
    <AuthenticatedAdminShell>
      <StudentsManager students={items} />
    </AuthenticatedAdminShell>
  );
}
