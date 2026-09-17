import { notFound } from "next/navigation";
import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { CompanyForm, type CompanyFormValues } from "@/components/admin/company-form";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { PERM_COMPANIES_UPDATE } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERM_COMPANIES_UPDATE);
  const { id } = await params;

  const company = await db.company.findUnique({ where: { id } });
  if (!company) notFound();

  const values: CompanyFormValues = {
    id: company.id,
    name: company.name,
    category: company.category,
    placementSession: company.placementSession,
    turnover: company.turnover,
    description: company.description,
  };

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Management</span>
            <h1>Edit Company</h1>
            <p>Students see this name and information wherever the company recruits.</p>
          </div>
        </section>
        <CompanyForm company={values} />
      </div>
    </AuthenticatedAdminShell>
  );
}
