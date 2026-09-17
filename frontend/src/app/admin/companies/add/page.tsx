import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { CompanyForm } from "@/components/admin/company-form";
import { requirePermission } from "@/lib/admin-session";
import { PERM_COMPANIES_CREATE } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePermission(PERM_COMPANIES_CREATE);

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Management</span>
            <h1>Add Company</h1>
            <p>A recruiter record has to exist before any of its events can be composed.</p>
          </div>
        </section>
        <CompanyForm company={null} />
      </div>
    </AuthenticatedAdminShell>
  );
}
