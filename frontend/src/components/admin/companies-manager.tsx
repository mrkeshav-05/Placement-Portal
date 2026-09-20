"use client";

import { Building2, Edit3, ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteCompany, type CompanyActionResult } from "@/app/admin/companies/actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { COMPANY_CATEGORIES } from "@/lib/company-schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type AdminCompanyItem = {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  placementSession: number | null;
  turnover: string | null;
  jobCount: number;
  activeJobCount: number;
  createdAt: string;
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function CompaniesManager({ companies }: { companies: AdminCompanyItem[] }) {
  const router = useRouter();
  const [result, setResult] = useState<CompanyActionResult>({});

  async function remove(formData: FormData) {
    const nextResult = await deleteCompany(formData);
    setResult(nextResult);
    if (nextResult.success) router.refresh();
  }

  const columns = useMemo<DataTableColumn<AdminCompanyItem>[]>(
    () => [
      {
        id: "name",
        header: "Company",
        width: "320px",
        sortValue: (company) => company.name,
        hideable: false,
        cell: (company) => (
          <span className="company-admin-name">
            <i>
              <Building2 />
            </i>
            <span>
              <strong>{company.name}</strong>
              <small>{company.description || "No company info"}</small>
            </span>
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        width: "120px",
        sortValue: (company) => company.category,
        cell: (company) =>
          company.category ? (
            <b className="cell-tag">{company.category}</b>
          ) : (
            <span className="dt-muted">Not set</span>
          ),
      },
      {
        id: "placementSession",
        header: "Session",
        width: "100px",
        sortValue: (company) => company.placementSession,
        cell: (company) =>
          company.placementSession ?? <span className="dt-muted">Not set</span>,
      },
      {
        id: "turnover",
        header: "Turnover",
        width: "120px",
        sortValue: (company) => company.turnover,
        cell: (company) => company.turnover || <span className="dt-muted">Not provided</span>,
      },
      {
        id: "website",
        header: "Website",
        width: "150px",
        sortValue: (company) => company.website,
        cell: (company) =>
          company.website ? (
            <a className="admin-external-link" href={company.website} target="_blank" rel="noreferrer">
              Open website <ExternalLink />
            </a>
          ) : (
            <span className="dt-muted">Not provided</span>
          ),
      },
      {
        id: "jobs",
        header: "Events",
        width: "140px",
        sortValue: (company) => company.jobCount,
        cell: (company) => (
          <span>
            <strong>{company.jobCount}</strong> total · {company.activeJobCount} active
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        width: "120px",
        sortValue: (company) => new Date(company.createdAt),
        cell: (company) => dateFormat.format(new Date(company.createdAt)),
      },
      {
        id: "actions",
        header: "Actions",
        width: "110px",
        hideable: false,
        cell: (company) => (
          <span className="row-actions">
            <Link
              href={`/admin/companies/${company.id}/edit`}
              title={`Edit ${company.name}`}
              aria-label={`Edit ${company.name}`}
            >
              <Edit3 />
            </Link>
            <form action={remove}>
              <input type="hidden" name="companyId" value={company.id} />
              <button
                title={company.jobCount ? "Remove events before deleting" : `Delete ${company.name}`}
                aria-label={`Delete ${company.name}`}
                disabled={company.jobCount > 0}
              >
                <Trash2 />
              </button>
            </form>
          </span>
        ),
      },
    ],
    // `remove` is redefined per render but closes over nothing that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const filters = useMemo<DataTableFilter<AdminCompanyItem>[]>(() => {
    const sessions = Array.from(
      new Set(companies.map((company) => company.placementSession).filter(Boolean)),
    ).sort((a, b) => Number(b) - Number(a));

    return [
      {
        id: "category",
        label: "Category",
        value: (company) => company.category ?? "",
        options: COMPANY_CATEGORIES.map((category) => ({ value: category, label: category })),
      },
      {
        id: "placementSession",
        label: "Session",
        value: (company) =>
          company.placementSession ? String(company.placementSession) : "",
        options: sessions.map((session) => ({ value: String(session), label: String(session) })),
      },
    ];
  }, [companies]);

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Management</span>
          <h1>Companies</h1>
          <p>Create recruiter profiles before publishing their events.</p>
        </div>
        <Link href="/admin/companies/add">
          <Plus />
          Add company
        </Link>
      </section>

      {result.success ? <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert> : null}
      {result.error ? <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert> : null}

      <DataTable
        title="All Companies"
        data={companies}
        columns={columns}
        getRowId={(company) => company.id}
        searchText={(company) =>
          `${company.name} ${company.category ?? ""} ${company.description ?? ""}`
        }
        searchPlaceholder="Search companies..."
        filters={filters}
        columnStorageKey="companies"
        minWidth={980}
        emptyIcon={<Building2 />}
        emptyTitle={companies.length ? "No matching companies" : "No companies yet"}
        emptyDescription={
          companies.length
            ? "Try changing your search or filters."
            : "Use Add company to create the first real recruiter record."
        }
      />
    </div>
  );
}
