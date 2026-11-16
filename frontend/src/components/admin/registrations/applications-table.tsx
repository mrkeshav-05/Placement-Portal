"use client";

import { useMemo, useState, useTransition } from "react";
import { Award, ExternalLink, FileText, Users } from "lucide-react";
import type { ApplicationStatus } from "@prisma/client";
import {
  bulkUpdateApplicationsAction,
  updateApplicationStatusAction,
} from "@/app/admin/applications/actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  isHiredStatus,
} from "@/lib/application-status";
import { exportFileLabel } from "@/lib/registration-export";
import { ExportActions } from "./export-actions";
import { EXPORT_COLUMNS, PIPELINE_DEFAULTS } from "./export-columns";
import { StatusBadge } from "./status-badge";
import type { AdminApplicationRow, JobOption } from "./types";

type Patch = Partial<Pick<AdminApplicationRow, "status" | "offerId">>;

/** Outcomes that are hard to take back once students are emailed. */
const CONFIRM_BEFORE: ApplicationStatus[] = ["REJECTED", "OFFER_DECLINED"];

const BULK_ACTIONS: { status: ApplicationStatus; label: string; tone?: "interview" | "select" | "reject" }[] = [
  { status: "SHORTLISTED", label: "Shortlist" },
  { status: "INTERVIEW", label: "Assessment / Interview", tone: "interview" },
  { status: "SELECTED", label: "Select", tone: "select" },
  { status: "REJECTED", label: "Not selected", tone: "reject" },
  { status: "OFFER_ACCEPTED", label: "Offer accepted", tone: "select" },
  { status: "OFFER_DECLINED", label: "Offer declined", tone: "reject" },
];

const dash = <span className="dt-muted">—</span>;

/**
 * Moves the chosen event's applicants (or the latest applications across all
 * events) through the recruitment stages: one at a time from the row, or in
 * bulk from the bar that appears when rows are ticked.
 */
export function ApplicationsTable({
  rows,
  job,
  jobs,
  canUpdate,
  onPatch,
  onMessage,
  onRecordPlacement,
}: {
  rows: AdminApplicationRow[];
  /** The chosen event, or null when the list spans every event. */
  job: JobOption | null;
  jobs: JobOption[];
  canUpdate: boolean;
  onPatch: (ids: string[], patch: Patch) => void;
  onMessage: (message: { type: "success" | "error"; text: string }) => void;
  onRecordPlacement: (row: AdminApplicationRow) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<DataTableView<AdminApplicationRow> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<ApplicationStatus | null>(null);

  const visibleRows = view?.allRows ?? rows;
  // Only rows the viewer can see are ever acted on: a selection made before
  // narrowing the filters must not change students who are no longer on screen.
  const selectedVisible = useMemo(
    () => visibleRows.filter((row) => selectedIds.has(row.id)),
    [visibleRows, selectedIds],
  );
  const allVisibleSelected = visibleRows.length > 0 && selectedVisible.length === visibleRows.length;

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of visibleRows) {
        if (allVisibleSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeOne(row: AdminApplicationRow, status: ApplicationStatus) {
    startTransition(async () => {
      const result = await updateApplicationStatusAction(row.id, status);
      if (result.error) {
        onMessage({ type: "error", text: result.error });
        return;
      }
      onPatch([row.id], { status });
      onMessage({ type: "success", text: `${row.studentName} is now ${APPLICATION_STATUS_LABELS[status]}.` });
    });
  }

  function changeMany(status: ApplicationStatus) {
    const ids = selectedVisible.map((row) => row.id);
    if (!ids.length) return;
    setConfirming(null);
    startTransition(async () => {
      const result = await bulkUpdateApplicationsAction(ids, status);
      if (result.error) {
        onMessage({ type: "error", text: result.error });
        return;
      }
      onPatch(ids, { status });
      setSelectedIds(new Set());
      onMessage({ type: "success", text: `${ids.length} student(s) moved to ${APPLICATION_STATUS_LABELS[status]}.` });
    });
  }

  const columns = useMemo<DataTableColumn<AdminApplicationRow>[]>(() => {
    const list: DataTableColumn<AdminApplicationRow>[] = [
      {
        id: "candidate",
        header: "Candidate",
        width: "230px",
        hideable: false,
        sortValue: (row) => row.studentName,
        cell: (row) => (
          <span className="dt-primary">
            <strong>{row.studentName}</strong>
            <small>{row.rollNumber ? `${row.rollNumber} · ${row.studentEmail}` : row.studentEmail}</small>
          </span>
        ),
      },
      { id: "branch", header: "Branch", width: "100px", sortValue: (row) => row.branch, cell: (row) => row.branch ?? dash },
      { id: "batch", header: "Batch", width: "80px", sortValue: (row) => row.batch, cell: (row) => row.batch ?? dash },
      { id: "cgpa", header: "CGPA", width: "80px", sortValue: (row) => row.cgpa, cell: (row) => row.cgpa ?? dash },
    ];
    if (!job) {
      list.push({
        id: "job",
        header: "Event",
        width: "210px",
        sortValue: (row) => `${row.companyName} ${row.jobTitle}`,
        cell: (row) => (
          <span className="dt-primary">
            <strong>{row.companyName}</strong>
            <small>{row.jobTitle}</small>
          </span>
        ),
      });
    }
    list.push(
      { id: "appliedAt", header: "Applied", width: "110px", sortValue: (row) => row.appliedAtIso, cell: (row) => <span className="dt-muted">{row.appliedAt}</span> },
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
            <span className="dt-muted">Default profile</span>
          ),
      },
      { id: "status", header: "Status", width: "150px", sortValue: (row) => row.status, cell: (row) => <StatusBadge status={row.status} /> },
    );
    if (canUpdate) {
      list.push(
        {
          id: "stage",
          header: "Move to",
          width: "210px",
          hideable: false,
          cell: (row) => (
            <select
              className="dt-inline-select"
              value={row.status}
              disabled={isPending}
              aria-label={`Change stage for ${row.studentName}`}
              onChange={(event) => {
                const next = event.target.value as ApplicationStatus;
                if (CONFIRM_BEFORE.includes(next) && !window.confirm(`Mark ${row.studentName} as ${APPLICATION_STATUS_LABELS[next]}? They will be notified.`)) return;
                changeOne(row, next);
              }}
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          ),
        },
        {
          id: "placement",
          header: "Placement record",
          width: "170px",
          hideable: false,
          cell: (row) =>
            isHiredStatus(row.status) ? (
              row.offerId ? (
                <a className="admin-external-link" href="/admin/placement-records" title="Open placement records">
                  <Award />
                  Recorded
                </a>
              ) : (
                <button type="button" className="dt-view-button" onClick={() => onRecordPlacement(row)}>
                  <Award />
                  Record placement
                </button>
              )
            ) : (
              dash
            ),
        },
      );
    }
    return list;
    // `changeOne` closes over stable setters only; the table re-renders cells on state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, canUpdate, isPending, onRecordPlacement]);

  const filters = useMemo<DataTableFilter<AdminApplicationRow>[]>(() => {
    const branches = Array.from(new Set(rows.map((row) => row.branch).filter(Boolean) as string[])).sort();
    const batches = Array.from(new Set(rows.map((row) => row.batch).filter((value) => value !== null) as number[])).sort((a, b) => b - a);
    const list: DataTableFilter<AdminApplicationRow>[] = [
      { id: "status", label: "Status", options: APPLICATION_STATUSES.map((status) => ({ value: status, label: APPLICATION_STATUS_LABELS[status] })), value: (row) => row.status },
      { id: "branch", label: "Branch", options: branches.map((value) => ({ value, label: value })), value: (row) => row.branch },
      { id: "batch", label: "Batch", options: batches.map((value) => ({ value: String(value), label: String(value) })), value: (row) => (row.batch === null ? null : String(row.batch)) },
    ];
    if (!job) {
      list.unshift({
        id: "job",
        label: "Event",
        searchable: true,
        options: jobs.map((item) => ({ value: item.id, label: `${item.companyName} — ${item.title}` })),
        value: (row) => row.jobProfileId,
      });
    }
    return list;
  }, [rows, jobs, job]);

  return (
    <>
      <DataTable
        title="Applications"
        actions={
          <ExportActions
            columns={EXPORT_COLUMNS}
            defaultSelection={PIPELINE_DEFAULTS}
            rows={visibleRows}
            fileLabel={exportFileLabel(job?.companyName, job?.title, "applications")}
            onMessage={onMessage}
          />
        }
        data={rows}
        columns={columns}
        filters={filters}
        getRowId={(row) => row.id}
        searchText={(row) =>
          `${row.studentName} ${row.studentEmail} ${row.rollNumber ?? ""} ${row.branch ?? ""} ${row.jobTitle} ${row.companyName}`
        }
        searchPlaceholder="Search student, roll number or company"
        columnStorageKey={job ? "applications-event-v2" : "applications-all-v2"}
        minWidth={1100}
        initialSort={{ columnId: "appliedAt", direction: "desc" }}
        onViewChange={setView}
        leadingColumn={
          canUpdate
            ? {
                header: (
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label={`Select all ${visibleRows.length} matching students`}
                  />
                ),
                cell: (row) => (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`Select ${row.studentName}`}
                  />
                ),
              }
            : undefined
        }
        emptyIcon={<Users />}
        emptyTitle={rows.length ? "No matching applications" : "No applications yet"}
        emptyDescription={
          rows.length
            ? "Try adjusting the search or filters."
            : "Applications to published events will appear here."
        }
      />

      {canUpdate && selectedVisible.length > 0 ? (
        <div className="bulk-action-bar bulk-action-bar--sticky" role="region" aria-label="Bulk actions">
          <span>
            <strong>{selectedVisible.length}</strong> selected
            {!allVisibleSelected ? (
              <button type="button" className="bulk-link" onClick={toggleAll}>
                Select all {visibleRows.length}
              </button>
            ) : null}
            <button type="button" className="bulk-link" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          </span>
          {confirming ? (
            <div>
              <span>
                Move {selectedVisible.length} to <strong>{APPLICATION_STATUS_LABELS[confirming]}</strong>? They will be notified.
              </span>
              <Button type="button" size="sm" variant="destructive" disabled={isPending} onClick={() => changeMany(confirming)}>
                Confirm
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div>
              {BULK_ACTIONS.map((action) => (
                <button
                  key={action.status}
                  type="button"
                  className={action.tone}
                  disabled={isPending}
                  onClick={() => (CONFIRM_BEFORE.includes(action.status) ? setConfirming(action.status) : changeMany(action.status))}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
