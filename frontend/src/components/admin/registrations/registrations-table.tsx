"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText, Users } from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from "@/components/common/data-table";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { exportFileLabel } from "@/lib/registration-export";
import { ExportActions } from "./export-actions";
import { EXPORT_COLUMNS, REGISTRATION_DEFAULTS } from "./export-columns";
import { StatusBadge } from "./status-badge";
import type { AdminApplicationRow, JobOption } from "./types";

const dash = <span className="dt-muted">—</span>;

/**
 * Who registered for the chosen event, with the contact details a recruiter
 * asks for. Read and export only: moving students between stages happens in
 * the other tab.
 */
export function RegistrationsTable({
  rows,
  job,
  onMessage,
}: {
  rows: AdminApplicationRow[];
  job: JobOption | null;
  onMessage: (message: { type: "success" | "error"; text: string }) => void;
}) {
  const [view, setView] = useState<DataTableView<AdminApplicationRow> | null>(null);
  const exportRows = view?.allRows ?? rows;

  const columns = useMemo<DataTableColumn<AdminApplicationRow>[]>(() => {
    const serial = new Map(rows.map((row, index) => [row.id, index + 1]));
    return [
      {
        id: "sno",
        header: "S.No",
        width: "64px",
        sticky: true,
        hideable: false,
        sortValue: (row) => serial.get(row.id) ?? 0,
        cell: (row) => <span>{serial.get(row.id)}</span>,
      },
      {
        id: "rollNumber",
        header: "Roll Number",
        width: "140px",
        sticky: true,
        hideable: false,
        sortValue: (row) => row.rollNumber,
        cell: (row) => (row.rollNumber ? <span className="identifier">{row.rollNumber}</span> : dash),
      },
      {
        id: "name",
        header: "Name",
        width: "190px",
        sticky: true,
        hideable: false,
        sortValue: (row) => row.studentName,
        cell: (row) => <strong>{row.studentName}</strong>,
      },
      { id: "contact", header: "Contact", width: "140px", sortValue: (row) => row.contactNumber, cell: (row) => row.contactNumber ?? dash },
      { id: "instituteEmail", header: "Institute mail", width: "250px", sortValue: (row) => row.studentEmail, cell: (row) => row.studentEmail },
      { id: "personalEmail", header: "Personal mail", width: "240px", sortValue: (row) => row.personalEmail, cell: (row) => row.personalEmail ?? dash },
      { id: "degree", header: "Degree", width: "96px", sortValue: (row) => row.degree, cell: (row) => row.degree ?? dash },
      { id: "branch", header: "Branch", width: "96px", sortValue: (row) => row.branch, cell: (row) => row.branch ?? dash },
      { id: "batch", header: "Batch", width: "84px", sortValue: (row) => row.batch, cell: (row) => row.batch ?? dash },
      { id: "cgpa", header: "CGPA", width: "84px", sortValue: (row) => row.cgpa, cell: (row) => row.cgpa ?? dash },
      { id: "cgpa12", header: "12th %", width: "84px", sortValue: (row) => row.class12Percent, cell: (row) => row.class12Percent ?? dash },
      { id: "cgpa10", header: "10th %", width: "84px", sortValue: (row) => row.class10Percent, cell: (row) => row.class10Percent ?? dash },
      {
        id: "resume",
        header: "Resume",
        width: "130px",
        sortValue: (row) => row.resumeLabel,
        cell: (row) =>
          row.resumeUrl ? (
            <a href={row.resumeUrl} target="_blank" rel="noreferrer" className="admin-external-link" title="Open attached resume">
              <FileText />
              {row.resumeLabel || "Resume"}
              <ExternalLink />
            </a>
          ) : (
            dash
          ),
      },
      { id: "status", header: "Status", width: "150px", sortValue: (row) => row.status, cell: (row) => <StatusBadge status={row.status} /> },
      { id: "appliedAt", header: "Applied", width: "110px", sortValue: (row) => row.appliedAtIso, cell: (row) => <span className="dt-muted">{row.appliedAt}</span> },
    ];
  }, [rows]);

  const filters = useMemo<DataTableFilter<AdminApplicationRow>[]>(() => {
    const unique = (pick: (row: AdminApplicationRow) => string | number | null) =>
      Array.from(new Set(rows.map(pick).filter((value) => value !== null && value !== "")))
        .map(String)
        .sort();
    return [
      { id: "status", label: "Status", options: APPLICATION_STATUSES.map((status) => ({ value: status, label: APPLICATION_STATUS_LABELS[status] })), value: (row) => row.status },
      { id: "branch", label: "Branch", options: unique((row) => row.branch).map((value) => ({ value, label: value })), value: (row) => row.branch },
      { id: "degree", label: "Degree", options: unique((row) => row.degree).map((value) => ({ value, label: value })), value: (row) => row.degree },
    ];
  }, [rows]);

  const fileLabel = exportFileLabel(job?.companyName, job?.title);

  return (
    <DataTable
      title="Registered students"
      actions={
        <ExportActions
          columns={EXPORT_COLUMNS}
          defaultSelection={REGISTRATION_DEFAULTS}
          rows={exportRows}
          fileLabel={fileLabel}
          withResumes
          onMessage={onMessage}
        />
      }
      data={rows}
      columns={columns}
      filters={filters}
      getRowId={(row) => row.id}
      searchText={(row) =>
        `${row.studentName} ${row.studentEmail} ${row.personalEmail ?? ""} ${row.rollNumber ?? ""} ${row.contactNumber ?? ""} ${row.branch ?? ""} ${row.degree ?? ""}`
      }
      searchPlaceholder="Search name, roll number, mail or contact"
      columnStorageKey="registrations-v2"
      minWidth={1400}
      onViewChange={setView}
      emptyIcon={<Users />}
      emptyTitle={rows.length ? "No matching registrations" : "No registrations yet"}
      emptyDescription={
        rows.length ? "Try a different search or clear the filters." : "No student has applied to this event yet."
      }
    />
  );
}
