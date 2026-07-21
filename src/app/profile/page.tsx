import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { ProfileView, type StudentProfileViewData } from "@/components/profile/profile-view";
import { db } from "@/lib/db";
import { calculateProfileCompletion } from "@/lib/student-profile";
import { requireStudent, studentDisplayName, studentInitials } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const student = await requireStudent();
  const resumes = student.user
    ? await db.resume.findMany({
        where: { userId: student.user.id },
        orderBy: { uploadedAt: "desc" },
      })
    : [];
  const name = studentDisplayName(student);
  const user = student.user;
  const profile: StudentProfileViewData = {
    canPersist: Boolean(user),
    initials: studentInitials(name),
    completion: user ? calculateProfileCompletion(user) : 0,
    email: user?.email ?? student.session.user.email ?? "",
    values: {
      name,
      rollNumber: user?.rollNumber ?? "",
      personalEmail: user?.personalEmail ?? "",
      contactNumber: user?.contactNumber ?? "",
      altContactNumber: user?.altContactNumber ?? "",
      branch: user?.branch ?? "",
      degree: user?.degree ?? "",
      batch: user?.batch?.toString() ?? "",
      gender: user?.gender ?? "",
      bloodGroup: user?.bloodGroup ?? "",
      dateOfBirth: user?.dateOfBirth?.toISOString().slice(0, 10) ?? "",
      currentAddress: user?.currentAddress ?? "",
      class10Percent: user?.class10Percent?.toString() ?? "",
      class12Percent: user?.class12Percent?.toString() ?? "",
      cgpa: user?.cgpa?.toString() ?? "",
      backlogs: user?.backlogs.toString() ?? "0",
    },
    identityDocuments: {
      aadhaarProvided: Boolean(user?.aadhaarEncrypted),
      panProvided: Boolean(user?.panCardEncrypted),
    },
    resumes: resumes.map((resume) => ({
      id: resume.id,
      label: resume.label,
      name: resume.fileName,
      uploadedAt: resume.uploadedAt.toISOString(),
    })),
  };

  return (
    <AuthenticatedPortalShell>
      <ProfileView profile={profile} />
    </AuthenticatedPortalShell>
  );
}
