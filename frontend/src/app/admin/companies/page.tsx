import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { CompaniesManager, type AdminCompanyItem } from "@/components/admin/companies-manager";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { PERM_COMPANIES_VIEW } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePermission(PERM_COMPANIES_VIEW);
  const companies = await db.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { jobs: { select: { status: true } } },
  });
  const items: AdminCompanyItem[] = companies.map((company) => ({
    id: company.id,
    name: company.name,
    website: company.website,
    logoUrl: company.logoUrl,
    description: company.description,
    category: company.category,
    placementSession: company.placementSession,
    turnover: company.turnover,
    jobCount: company.jobs.length,
    activeJobCount: company.jobs.filter((job) => job.status === "ACTIVE").length,
    createdAt: company.createdAt.toISOString(),
  }));

  return <AuthenticatedAdminShell><CompaniesManager companies={items}/></AuthenticatedAdminShell>;
}
