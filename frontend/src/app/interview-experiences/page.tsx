import { InterviewExperiencesView, type InterviewExperienceItem } from "@/components/interview-experiences/interview-experiences-view";
import type { BankCompany, BankCompanyDetail } from "@/components/interview-experiences/interview-sections";
import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { backendFetch } from "@/lib/api-client";
import { requireStudent } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  await requireStudent();
  const requested = (await searchParams).company?.trim() || null;

  let approved: InterviewExperienceItem[] = [];
  let mine: InterviewExperienceItem[] = [];
  let companies: string[] = [];
  let bankCompanies: BankCompany[] = [];
  let bankDetail: BankCompanyDetail | null = null;
  let bankMissing: string | null = null;

  try {
    [approved, mine, companies, bankCompanies] = await Promise.all([
      backendFetch<InterviewExperienceItem[]>("/api/v1/interview-experiences?limit=200"),
      backendFetch<InterviewExperienceItem[]>("/api/v1/interview-experiences/mine"),
      backendFetch<string[]>("/api/v1/interview-experiences/companies"),
      backendFetch<BankCompany[]>("/api/v1/interview-experiences/bank/companies"),
    ]);
  } catch (err) {
    console.error("Failed to fetch interview experiences", err);
  }

  if (requested) {
    try {
      bankDetail = await backendFetch<BankCompanyDetail>(
        `/api/v1/interview-experiences/bank?${new URLSearchParams({ company: requested })}`,
      );
    } catch {
      // A company nobody has written about is a 404, not a failure of the page.
      bankMissing = requested;
    }
  }

  return (
    <AuthenticatedPortalShell>
      <InterviewExperiencesView
        approvedExperiences={approved}
        myExperiences={mine}
        companies={companies}
        bankCompanies={bankCompanies}
        bankDetail={bankDetail}
        bankMissing={bankMissing}
      />
    </AuthenticatedPortalShell>
  );
}
