"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Download,
  CheckCircle2,
  Clock3,
  Users,
  Briefcase,
  FileText,
  ExternalLink,
  CalendarRange,
  Building2,
  ClipboardList,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import type { ApplicationStatus } from "@prisma/client";
import {
  updateApplicationStatusAction,
  bulkUpdateApplicationsAction,
} from "@/app/admin/applications/actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from "@/components/common/data-table";
import {
  ExportColumnsDialog,
  buildDefaultExportSelection,
  type ExportColumnDef,
} from "@/components/admin/export-columns-dialog";

export type AdminApplicationRow = {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  rollNumber: string | null;
  branch: string | null;
  batch: number | null;
  degree: string | null;
  cgpa: number | null;
  class10Percent: number | null;
  class12Percent: number | null;
  personalEmail: string | null;
  contactNumber: string | null;
  jobProfileId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  resumeId: string | null;
  resumeUrl: string | null;
  resumeLabel: string | null;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
};

export type JobOption = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  batch: number;
};

const REGISTRATION_EXPORT_COLUMNS: ExportColumnDef<AdminApplicationRow>[] = [
  { id: "sno", label: "S.No", group: "Basic", locked: true, value: (_row, index) => index + 1 },
  { id: "rollNumber", label: "Roll Number", group: "Basic", locked: true, value: (row) => row.rollNumber ?? "" },
  { id: "name", label: "Name", group: "Basic", locked: true, value: (row) => row.studentName },
  { id: "instituteEmail", label: "Institute Mail ID", group: "Basic", locked: true, value: (row) => row.studentEmail },
  { id: "contact", label: "Contact", group: "Basic", defaultSelected: true, value: (row) => row.contactNumber ?? "" },
  { id: "personalEmail", label: "Personal Mail ID", group: "Basic", defaultSelected: true, value: (row) => row.personalEmail ?? "" },
  { id: "resumeUrl", label: "Resume URL", group: "Basic", value: (row) => row.resumeUrl ?? "" },
  { id: "appliedAt", label: "Applied At", group: "Basic", value: (row) => row.appliedAt },
  { id: "batch", label: "Batch", group: "Academic", defaultSelected: true, value: (row) => row.batch ?? "" },
  { id: "degree", label: "Degree", group: "Academic", defaultSelected: true, value: (row) => row.degree ?? "" },
  { id: "branch", label: "Branch", group: "Academic", defaultSelected: true, value: (row) => row.branch ?? "" },
  { id: "cgpa", label: "CGPA", group: "Academic", defaultSelected: true, value: (row) => row.cgpa ?? "" },
  { id: "cgpa12", label: "CGPA 12th", group: "Academic", defaultSelected: true, value: (row) => row.class12Percent ?? "" },
  { id: "cgpa10", label: "CGPA 10th", group: "Academic", defaultSelected: true, value: (row) => row.class10Percent ?? "" },
  { id: "companyName", label: "Company", group: "Application", value: (row) => row.companyName },
  { id: "jobTitle", label: "Role", group: "Application", value: (row) => row.jobTitle },
  { id: "status", label: "Status", group: "Application", value: (row) => row.status },
];

const ALL_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
];

/** The filter ids the backend export understands, matched one to one below. */
const JOB_FILTER = "job";
const STATUS_FILTER = "status";
const BRANCH_FILTER = "branch";

export function ApplicationsManager({
  applications: initialApplications,
  jobs,
}: {
  applications: AdminApplicationRow[];
  jobs: JobOption[];
}) {
  const [applications, setApplications] = useState<AdminApplicationRow[]>(initialApplications);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<DataTableView<AdminApplicationRow> | null>(null);

  // --- View Registrations: season -> company -> company event ------------
  const seasons = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.batch))).sort((a, b) => b - a),
    [jobs],
  );
  const [season, setSeason] = useState<number | null>(seasons[0] ?? null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const companiesForSeason = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) {
      if (season !== null && job.batch !== season) continue;
      map.set(job.companyId, job.companyName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs, season]);

  const eventsForCompany = useMemo(
    () => jobs.filter((job) => job.companyId === companyId && (season === null || job.batch === season)),
    [jobs, companyId, season],
  );

  function handleSeasonChange(value: string) {
    setSeason(value ? Number(value) : null);
    setCompanyId(null);
    setJobId(null);
  }

  function handleCompanyChange(value: string) {
    setCompanyId(value || null);
    setJobId(null);
  }

  const scopedApplications = useMemo(
    () => (jobId ? applications.filter((app) => app.jobProfileId === jobId) : []),
    [applications, jobId],
  );

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<Set<string>>(() =>
    buildDefaultExportSelection(REGISTRATION_EXPORT_COLUMNS),
  );
  const [downloadingResumes, setDownloadingResumes] = useState(false);

  const registrationsFileLabel = useMemo(() => {
    const job = jobs.find((j) => j.id === jobId);
    return job ? `${job.companyName}_${job.title}`.replace(/[^a-z0-9]+/gi, "_") : "registrations";
  }, [jobs, jobId]);

  function handleExportExcel() {
    if (!scopedApplications.length) return;
    const columns = REGISTRATION_EXPORT_COLUMNS.filter(
      (col) => col.locked || exportColumns.has(col.id),
    );
    const rows = scopedApplications.map((app, index) => {
      const row: Record<string, string | number> = {};
      for (const col of columns) row[col.label] = col.value(app, index);
      return row;
    });

    import("xlsx").then((XLSX) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");
      XLSX.writeFile(workbook, `${registrationsFileLabel}.xlsx`);
    });
  }

  async function handleDownloadResumes() {
    const withResumes = scopedApplications.filter((app) => app.resumeUrl);
    if (!withResumes.length) {
      setStatusMessage({ type: "error", text: "No resumes available for the current selection." });
      return;
    }

    setDownloadingResumes(true);
    setStatusMessage(null);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let failed = 0;

      await Promise.all(
        withResumes.map(async (app) => {
          try {
            const res = await fetch(app.resumeUrl!);
            if (!res.ok) throw new Error("fetch failed");
            const blob = await res.blob();
            const safeName = (app.rollNumber || app.studentName || app.id).replace(/[^a-z0-9-_]+/gi, "_");
            zip.file(`${safeName}.pdf`, blob);
          } catch {
            failed += 1;
          }
        }),
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${registrationsFileLabel}_resumes.zip`;
      link.click();
      URL.revokeObjectURL(url);

      setStatusMessage(
        failed
          ? { type: "error", text: `Downloaded ${withResumes.length - failed} resume(s); ${failed} failed.` }
          : { type: "success", text: `Downloaded ${withResumes.length} resume(s).` },
      );
    } finally {
      setDownloadingResumes(false);
    }
  }

  const branches = useMemo(() => {
    const set = new Set<string>();
    for (const app of applications) {
      if (app.branch) set.add(app.branch);
    }
    return Array.from(set).sort();
  }, [applications]);

  const stats = useMemo(() => {
    const total = applications.length;
    const shortlisted = applications.filter((a) => a.status === "SHORTLISTED").length;
    const interviews = applications.filter((a) => a.status === "INTERVIEW").length;
    const selected = applications.filter((a) => a.status === "SELECTED").length;
    const rejected = applications.filter((a) => a.status === "REJECTED").length;
    return { total, shortlisted, interviews, selected, rejected };
  }, [applications]);

  const rowsOnPage = view?.rows ?? [];
  const allOnPageSelected = rowsOnPage.length > 0 && rowsOnPage.every((a) => selectedIds.has(a.id));

  // Select-all covers the rows the viewer can actually see, which on a
  // paginated table is the current page rather than the whole result set.
  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    for (const item of rowsOnPage) {
      if (allOnPageSelected) next.delete(item.id);
      else next.add(item.id);
    }
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSingleStatusChange = (appId: string, newStatus: ApplicationStatus) => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await updateApplicationStatusAction(appId, newStatus);
      if (res.error) {
        setStatusMessage({ type: "error", text: res.error });
      } else {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a)),
        );
        setStatusMessage({ type: "success", text: res.success ?? "Status updated." });
      }
    });
  };

  const handleBulkStatusChange = (newStatus: ApplicationStatus) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    startTransition(async () => {
      setStatusMessage(null);
      const res = await bulkUpdateApplicationsAction(ids, newStatus);
      if (res.error) {
        setStatusMessage({ type: "error", text: res.error });
      } else {
        setApplications((prev) =>
          prev.map((a) => (selectedIds.has(a.id) ? { ...a, status: newStatus } : a)),
        );
        setSelectedIds(new Set());
        setStatusMessage({ type: "success", text: res.success ?? "Bulk status updated." });
      }
    });
  };

  // The CSV comes from the backend, which owns the query and includes the
  // resume label. The endpoint takes one value per filter, so a multi-select
  // narrows the export only when exactly one option is chosen; the file then
  // matches the screen instead of quietly disagreeing with it.
  const exportHref = useMemo(() => {
    const query = new URLSearchParams();
    const single = (id: string) => {
      const values = view?.filters?.[id] ?? [];
      return values.length === 1 ? values[0] : null;
    };

    const job = single(JOB_FILTER);
    const status = single(STATUS_FILTER);
    const branch = single(BRANCH_FILTER);
    if (job) query.set("job_id", job);
    if (status) query.set("status", status);
    if (branch) query.set("branch", branch);
    if (view?.query.trim()) query.set("search", view.query.trim());

    const suffix = query.size ? `?${query}` : "";
    return `/api/admin/applications/export${suffix}`;
  }, [view]);

  const getStatusBadgeClass = (status: ApplicationStatus) => {
    switch (status) {
      case "SELECTED":
        return "cell-status";
      case "SHORTLISTED":
        return "cell-status";
      case "INTERVIEW":
        return "cell-status draft";
      case "REJECTED":
        return "cell-status pending";
      case "WITHDRAWN":
        return "cell-status pending";
      case "APPLIED":
      default:
        return "cell-status development";
    }
  };

  const columns = useMemo<DataTableColumn<AdminApplicationRow>[]>(
    () => [
      {
        id: "candidate",
        header: "Candidate",
        width: "minmax(200px, 1.5fr)",
        hideable: false,
        sortValue: (app) => app.studentName,
        cell: (app) => (
          <span className="dt-primary">
            <strong>{app.studentName}</strong>
            <small>{app.studentEmail}</small>
            {app.rollNumber ? <small>{app.rollNumber}</small> : null}
          </span>
        ),
      },
      {
        id: "branch",
        header: "Branch",
        width: "minmax(130px, 1fr)",
        sortValue: (app) => app.branch,
        cell: (app) => app.branch ?? <span className="dt-muted">Not specified</span>,
      },
      {
        id: "batch",
        header: "Batch",
        width: "90px",
        sortValue: (app) => app.batch,
        cell: (app) => <span className="dt-numeric">{app.batch ?? "—"}</span>,
      },
      {
        id: "cgpa",
        header: "CGPA",
        width: "90px",
        sortValue: (app) => app.cgpa,
        cell: (app) => <span className="dt-numeric">{app.cgpa ?? "—"}</span>,
      },
      {
        id: "job",
        header: "Job & company",
        width: "minmax(190px, 1.4fr)",
        sortValue: (app) => `${app.companyName} ${app.jobTitle}`,
        cell: (app) => (
          <span className="dt-primary">
            <strong>{app.companyName}</strong>
            <small>{app.jobTitle}</small>
          </span>
        ),
      },
      {
        id: "appliedAt",
        header: "Applied",
        width: "minmax(120px, 1fr)",
        // `appliedAt` is already a display string from the server, so the raw
        // date is parsed here rather than compared as text.
        sortValue: (app) => new Date(app.appliedAt),
        cell: (app) => <span className="dt-muted">{app.appliedAt}</span>,
      },
      {
        id: "resume",
        header: "Resume",
        width: "minmax(140px, 1fr)",
        sortValue: (app) => app.resumeLabel,
        cell: (app) =>
          app.resumeUrl ? (
            <a
              href={app.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="admin-external-link"
              title="Open attached resume"
            >
              <FileText />
              {app.resumeLabel || "Resume"}
              <ExternalLink />
            </a>
          ) : (
            <span className="dt-muted">Default profile</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        width: "130px",
        sortValue: (app) => app.status,
        cell: (app) => <b className={getStatusBadgeClass(app.status)}>{app.status}</b>,
      },
      {
        id: "stage",
        header: "Stage action",
        width: "150px",
        hideable: false,
        cell: (app) => (
          <select
            className="dt-inline-select"
            value={app.status}
            disabled={isPending}
            aria-label={`Change stage for ${app.studentName}`}
            onChange={(e) => handleSingleStatusChange(app.id, e.target.value as ApplicationStatus)}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ),
      },
    ],
    [isPending],
  );

  const filters = useMemo<DataTableFilter<AdminApplicationRow>[]>(
    () => [
      {
        id: JOB_FILTER,
        label: "Job profile",
        options: jobs.map((job) => ({
          value: job.id,
          label: `${job.companyName} — ${job.title}`,
        })),
        value: (app) => app.jobProfileId,
      },
      {
        id: STATUS_FILTER,
        label: "Status",
        options: ALL_STATUSES.map((status) => ({ value: status, label: status })),
        value: (app) => app.status,
      },
      {
        id: BRANCH_FILTER,
        label: "Branch",
        options: branches.map((branch) => ({ value: branch, label: branch })),
        value: (app) => app.branch,
      },
    ],
    [jobs, branches],
  );

  const registrationColumns = useMemo<DataTableColumn<AdminApplicationRow>[]>(() => {
    const indexById = new Map(scopedApplications.map((app, index) => [app.id, index]));
    return [
      {
        id: "sno",
        header: "S.No",
        width: "64px",
        hideable: false,
        cell: (app) => <span className="dt-numeric">{(indexById.get(app.id) ?? 0) + 1}</span>,
      },
      {
        id: "rollNumber",
        header: "Roll Number",
        width: "minmax(120px, 1fr)",
        hideable: false,
        sortValue: (app) => app.rollNumber,
        cell: (app) => app.rollNumber ?? <span className="dt-muted">—</span>,
      },
      {
        id: "name",
        header: "Name",
        width: "minmax(160px, 1.2fr)",
        hideable: false,
        sortValue: (app) => app.studentName,
        cell: (app) => <strong>{app.studentName}</strong>,
      },
      {
        id: "contact",
        header: "Contact",
        width: "minmax(120px, 1fr)",
        cell: (app) => app.contactNumber ?? <span className="dt-muted">—</span>,
      },
      {
        id: "instituteEmail",
        header: "Institute Mail ID",
        width: "minmax(190px, 1.3fr)",
        sortValue: (app) => app.studentEmail,
        cell: (app) => app.studentEmail,
      },
      {
        id: "personalEmail",
        header: "Personal Mail ID",
        width: "minmax(190px, 1.3fr)",
        cell: (app) => app.personalEmail ?? <span className="dt-muted">—</span>,
      },
      {
        id: "degree",
        header: "Degree",
        width: "minmax(90px, 0.8fr)",
        sortValue: (app) => app.degree,
        cell: (app) => app.degree ?? <span className="dt-muted">—</span>,
      },
      {
        id: "branch",
        header: "Branch",
        width: "minmax(100px, 0.8fr)",
        sortValue: (app) => app.branch,
        cell: (app) => app.branch ?? <span className="dt-muted">—</span>,
      },
      {
        id: "batch",
        header: "Batch",
        width: "90px",
        sortValue: (app) => app.batch,
        cell: (app) => <span className="dt-numeric">{app.batch ?? "—"}</span>,
      },
      {
        id: "cgpa",
        header: "CGPA",
        width: "90px",
        sortValue: (app) => app.cgpa,
        cell: (app) => <span className="dt-numeric">{app.cgpa ?? "—"}</span>,
      },
      {
        id: "cgpa12",
        header: "CGPA 12th",
        width: "100px",
        sortValue: (app) => app.class12Percent,
        cell: (app) => <span className="dt-numeric">{app.class12Percent ?? "—"}</span>,
      },
      {
        id: "cgpa10",
        header: "CGPA 10th",
        width: "100px",
        sortValue: (app) => app.class10Percent,
        cell: (app) => <span className="dt-numeric">{app.class10Percent ?? "—"}</span>,
      },
      {
        id: "resume",
        header: "Resume",
        width: "minmax(120px, 1fr)",
        cell: (app) =>
          app.resumeUrl ? (
            <a
              href={app.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="admin-external-link"
              title="Open attached resume"
            >
              <FileText />
              {app.resumeLabel || "Resume"}
            </a>
          ) : (
            <span className="dt-muted">—</span>
          ),
      },
    ];
  }, [scopedApplications]);

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Registrations</span>
          <h1>View Registrations</h1>
          <p>Browse and export student registrations by company event.</p>
        </div>
      </section>

      {statusMessage ? (
        <div className={statusMessage.type === "success" ? "admin-success" : "admin-error"}>
          {statusMessage.text}
        </div>
      ) : null}

      <div className="registrations-filters">
        <label className="season-picker">
          <CalendarRange />
          <span>Select Season</span>
          <select
            value={season ?? ""}
            onChange={(e) => handleSeasonChange(e.target.value)}
            disabled={!seasons.length}
            aria-label="Select season"
          >
            {seasons.length ? (
              seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            ) : (
              <option value="">No seasons yet</option>
            )}
          </select>
        </label>

        <label className="season-picker">
          <Building2 />
          <span>Select Company</span>
          <select
            value={companyId ?? ""}
            onChange={(e) => handleCompanyChange(e.target.value)}
            disabled={!companiesForSeason.length}
            aria-label="Select company"
          >
            <option value="">--</option>
            {companiesForSeason.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="season-picker">
          <ClipboardList />
          <span>Select Company Event</span>
          <select
            value={jobId ?? ""}
            onChange={(e) => setJobId(e.target.value || null)}
            disabled={!companyId}
            aria-label="Select company event"
          >
            <option value="">{companyId ? "--" : "Select Company First"}</option>
            {eventsForCompany.map((job) => (
              <option key={job.id} value={job.id}>
                {job.companyName} — {job.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="admin-card registrations-card">
        <div className="registrations-card-header">
          <h2>Registered Students{jobId ? ` (${scopedApplications.length})` : ""}</h2>
          <div className="registrations-actions">
            <button type="button" className="dt-view-button" onClick={() => setExportDialogOpen(true)}>
              <SlidersHorizontal />
              Customize Export
              <b>{exportColumns.size}</b>
            </button>
            <button
              type="button"
              className="dt-view-button"
              onClick={handleDownloadResumes}
              disabled={!jobId || !scopedApplications.length || downloadingResumes}
            >
              <Download />
              {downloadingResumes ? "Preparing…" : "Download Resumes"}
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleExportExcel}
              disabled={!jobId || !scopedApplications.length}
            >
              <FileSpreadsheet />
              Export Excel
            </button>
          </div>
        </div>

        <DataTable
          data={scopedApplications}
          columns={registrationColumns}
          getRowId={(app) => app.id}
          searchText={(app) =>
            `${app.studentName} ${app.studentEmail} ${app.personalEmail ?? ""} ${app.rollNumber ?? ""} ${app.contactNumber ?? ""} ${app.branch ?? ""}`
          }
          searchPlaceholder="Search..."
          columnStorageKey="registrations"
          minWidth={1500}
          emptyIcon={<Users />}
          emptyTitle={jobId ? "No matching registrations" : "Select a company event"}
          emptyDescription={
            jobId
              ? "Try a different search."
              : "Select a company event to view registrations."
          }
        />
      </section>

      {exportDialogOpen ? (
        <ExportColumnsDialog
          columns={REGISTRATION_EXPORT_COLUMNS}
          selected={exportColumns}
          onChange={setExportColumns}
          onClose={() => setExportDialogOpen(false)}
          onApply={() => setExportDialogOpen(false)}
        />
      ) : null}

      <section className="admin-heading">
        <div>
          <span className="eyebrow">Candidate Management</span>
          <h1>Applications</h1>
          <p>Review candidate profiles, download resumes, and manage recruitment stage progression.</p>
        </div>
        <a href={exportHref} download title="Export CSV of filtered applications">
          <Download /> Export CSV
        </a>
      </section>

      <section className="admin-metrics">
        <article>
          <div className="company-admin-name">
            <i><Users /></i>
          </div>
          <div>
            <small>Total Applications</small>
            <strong>{stats.total}</strong>
            <b>All roles combined</b>
          </div>
        </article>
        <article>
          <div className="company-admin-name">
            <i style={{ background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)" }}>
              <Clock3 />
            </i>
          </div>
          <div>
            <small>Shortlisted</small>
            <strong>{stats.shortlisted}</strong>
            <b style={{ color: "var(--blue)" }}>Ready for evaluation</b>
          </div>
        </article>
        <article>
          <div className="company-admin-name">
            <i style={{ background: "var(--badge-orange-bg)", color: "var(--orange)" }}>
              <Briefcase />
            </i>
          </div>
          <div>
            <small>In Interview</small>
            <strong>{stats.interviews}</strong>
            <b style={{ color: "var(--orange)" }}>Active rounds</b>
          </div>
        </article>
        <article>
          <div className="company-admin-name">
            <i style={{ background: "var(--badge-green-bg)", color: "var(--green)" }}>
              <CheckCircle2 />
            </i>
          </div>
          <div>
            <small>Offers / Selected</small>
            <strong>{stats.selected}</strong>
            <b>Final selections</b>
          </div>
        </article>
      </section>

      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span>
            Selected <strong>{selectedIds.size}</strong> candidate(s)
          </span>
          <div>
            <button onClick={() => handleBulkStatusChange("SHORTLISTED")} disabled={isPending}>
              Mark Shortlisted
            </button>
            <button
              className="interview"
              onClick={() => handleBulkStatusChange("INTERVIEW")}
              disabled={isPending}
            >
              Move to Interview
            </button>
            <button
              className="select"
              onClick={() => handleBulkStatusChange("SELECTED")}
              disabled={isPending}
            >
              Select / Offer
            </button>
            <button
              className="reject"
              onClick={() => handleBulkStatusChange("REJECTED")}
              disabled={isPending}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <DataTable
        data={applications}
        columns={columns}
        filters={filters}
        getRowId={(app) => app.id}
        searchText={(app) =>
          `${app.studentName} ${app.studentEmail} ${app.rollNumber ?? ""} ${app.branch ?? ""} ${app.jobTitle} ${app.companyName}`
        }
        searchPlaceholder="Search candidate, email, roll no, or company"
        columnStorageKey="applications"
        minWidth={1280}
        initialSort={{ columnId: "appliedAt", direction: "desc" }}
        onViewChange={setView}
        leadingColumn={{
          header: (
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleSelectAll}
              aria-label="Select all candidates on this page"
            />
          ),
          cell: (app) => (
            <input
              type="checkbox"
              checked={selectedIds.has(app.id)}
              onChange={() => toggleSelectOne(app.id)}
              aria-label={`Select ${app.studentName}`}
            />
          ),
        }}
        emptyIcon={<Users />}
        emptyTitle={applications.length ? "No matching candidates" : "No applications yet"}
        emptyDescription={
          applications.length
            ? "Try adjusting your search query, job profile, status, or branch filters."
            : "Student applications submitted to active job postings will appear here."
        }
      />
    </div>
  );
}
