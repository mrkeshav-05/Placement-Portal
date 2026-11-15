"use client";

import { Award, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  setPpoOutcomeAction,
  setPpoOutcomesBulkAction,
} from "@/app/admin/placement-records/actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from "@/components/common/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatStipend } from "@/lib/offer-schema";
import { PPO_STATUS_LABELS, type PpoStatus } from "@/lib/placement-policy";

export type PpoInternship = {
  id: string;
  ppoStatus: PpoStatus;
  jobTitle: string | null;
  stipend: number | null;
  batch: number;
  offeredAt: string | null;
  joiningDate: string | null;
  endDate: string | null;
  company: { id: string; name: string } | null;
  student: {
    id: string;
    name: string | null;
    rollNumber: string | null;
    branch: string | null;
    degree: string | null;
    batch: number | null;
  } | null;
};

type Stage = "Ongoing" | "Completed" | "Dates not recorded";

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Completed once its end date has passed; with no end date the stage is unknown, not "ongoing". */
function stageOf(internship: PpoInternship): Stage {
  if (!internship.endDate) return "Dates not recorded";
  return new Date(internship.endDate).getTime() < Date.now() ? "Completed" : "Ongoing";
}

function studentName(internship: PpoInternship) {
  return internship.student?.name ?? internship.student?.rollNumber ?? "Student";
}

const unique = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

/**
 * The one-row control: No PPO is a single click; Got PPO asks for the CTC in
 * place, because a received PPO is recorded as a placement and needs it.
 */
function OutcomeCell({
  internship,
  busy,
  onSet,
}: {
  internship: PpoInternship;
  busy: boolean;
  onSet: (internship: PpoInternship, status: PpoStatus, ctc?: string) => void;
}) {
  const [askingCtc, setAskingCtc] = useState(false);
  const [ctc, setCtc] = useState("");
  const current = internship.ppoStatus;

  if (askingCtc) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSet(internship, "RECEIVED", ctc);
          setAskingCtc(false);
        }}
      >
        <Input
          autoFocus
          required
          type="number"
          min={0}
          step="any"
          value={ctc}
          onChange={(input) => setCtc(input.target.value)}
          placeholder="Annual CTC (₹)"
          aria-label={`Annual CTC for ${studentName(internship)}`}
          className="h-8 w-[150px]"
        />
        <Button type="submit" size="sm" disabled={busy || !ctc.trim()}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAskingCtc(false)}>
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <span className="inline-flex gap-1.5" role="group" aria-label={`PPO outcome for ${studentName(internship)}`}>
      <Button
        type="button"
        size="sm"
        variant={current === "NOT_RECEIVED" ? "default" : "outline"}
        disabled={busy}
        aria-pressed={current === "NOT_RECEIVED"}
        onClick={() => current !== "NOT_RECEIVED" && onSet(internship, "NOT_RECEIVED")}
      >
        No PPO
      </Button>
      <Button
        type="button"
        size="sm"
        variant={current === "RECEIVED" ? "default" : "outline"}
        disabled={busy}
        aria-pressed={current === "RECEIVED"}
        onClick={() => setAskingCtc(true)}
      >
        Got PPO
      </Button>
      {current !== "PENDING" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          title="Set back to pending"
          onClick={() => onSet(internship, "PENDING")}
        >
          Undo
        </Button>
      ) : null}
    </span>
  );
}

export function PpoWorklist({
  internships,
  backendError,
  truncated,
}: {
  internships: PpoInternship[];
  backendError: string | null;
  truncated: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // What the office has just recorded, shown at once; the server copy catches
  // up on the refresh. Keyed by offer id.
  const [overrides, setOverrides] = useState<Record<string, PpoStatus>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCtc, setBulkCtc] = useState("");
  const [view, setView] = useState<DataTableView<PpoInternship> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const rows = useMemo(
    () => internships.map((o) => ({ ...o, ppoStatus: overrides[o.id] ?? o.ppoStatus })),
    [internships, overrides],
  );

  const counts = useMemo(
    () => ({
      pending: rows.filter((o) => o.ppoStatus === "PENDING").length,
      received: rows.filter((o) => o.ppoStatus === "RECEIVED").length,
      notReceived: rows.filter((o) => o.ppoStatus === "NOT_RECEIVED").length,
    }),
    [rows],
  );

  function applyLocally(ids: string[], status: PpoStatus) {
    setOverrides((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, status])) }));
  }

  function setOne(internship: PpoInternship, status: PpoStatus, ctc?: string) {
    const formData = new FormData();
    formData.set("offerId", internship.id);
    formData.set("status", status);
    if (ctc) formData.set("ctc", ctc);
    setMessage(null);
    setBusyIds((ids) => new Set(ids).add(internship.id));
    startTransition(async () => {
      const result = await setPpoOutcomeAction(formData);
      setBusyIds((ids) => {
        const next = new Set(ids);
        next.delete(internship.id);
        return next;
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      applyLocally([internship.id], status);
      setMessage({ type: "success", text: `${studentName(internship)}: ${result.success}` });
      router.refresh();
    });
  }

  function setMany(status: PpoStatus) {
    const ids = [...selectedIds];
    const formData = new FormData();
    for (const id of ids) formData.append("offerId", id);
    formData.set("status", status);
    if (status === "RECEIVED") formData.set("ctc", bulkCtc);
    setMessage(null);
    startTransition(async () => {
      const result = await setPpoOutcomesBulkAction(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      const skipped = new Set((result.skipped ?? []).map((entry) => entry.offerId));
      applyLocally(ids.filter((id) => !skipped.has(id)), status);
      setSelectedIds(new Set(skipped));
      setBulkCtc("");
      setMessage({
        type: skipped.size ? "error" : "success",
        text: skipped.size
          ? `${result.success} ${skipped.size} could not be updated: ${(result.skipped ?? [])[0]?.reason}`
          : (result.success ?? "Updated."),
      });
      router.refresh();
    });
  }

  const rowsOnPage = view?.rows ?? [];
  const allOnPageSelected = rowsOnPage.length > 0 && rowsOnPage.every((o) => selectedIds.has(o.id));
  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    for (const o of rowsOnPage) {
      if (allOnPageSelected) next.delete(o.id);
      else next.add(o.id);
    }
    setSelectedIds(next);
  };
  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const columns = useMemo<DataTableColumn<PpoInternship>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: "220px",
        sticky: true,
        hideable: false,
        sortValue: (o) => o.student?.name ?? o.student?.rollNumber,
        cell: (o) => (
          <span className="dt-primary">
            <strong>{studentName(o)}</strong>
            <small className="identifier">{o.student?.rollNumber ?? "No roll number"}</small>
          </span>
        ),
      },
      {
        id: "programme",
        header: "Programme",
        width: "190px",
        sortValue: (o) => o.student?.branch,
        cell: (o) => (
          <span className="dt-primary">
            <strong>{o.student?.branch ?? "Branch not set"}</strong>
            <small>
              {[o.student?.degree, o.student?.batch ? `Batch ${o.student.batch}` : null].filter(Boolean).join(" · ") ||
                "Degree not set"}
            </small>
          </span>
        ),
      },
      {
        id: "internship",
        header: "Internship",
        width: "240px",
        sortValue: (o) => o.company?.name,
        cell: (o) => (
          <span className="dt-primary">
            <strong>{o.company?.name ?? "Company not recorded"}</strong>
            <small>
              {[o.jobTitle, o.stipend != null ? formatStipend(o.stipend) : null].filter(Boolean).join(" · ") ||
                "Role not recorded"}
            </small>
          </span>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        width: "150px",
        sortValue: (o) => (o.endDate ? new Date(o.endDate) : null),
        cell: (o) => (
          <span className="dt-primary">
            <strong>{stageOf(o)}</strong>
            <small>{o.endDate ? `ends ${dateFormatter.format(new Date(o.endDate))}` : `season ${o.batch}`}</small>
          </span>
        ),
      },
      {
        id: "outcome",
        header: "PPO outcome",
        width: "330px",
        hideable: false,
        sortValue: (o) => o.ppoStatus,
        cell: (o) => <OutcomeCell internship={o} busy={busyIds.has(o.id)} onSet={setOne} />,
      },
    ],
    // `setOne` closes over stable setters only; the columns need rebuilding when what they display changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyIds],
  );

  const filters = useMemo<DataTableFilter<PpoInternship>[]>(
    () => [
      {
        id: "ppo",
        label: "PPO",
        options: Object.entries(PPO_STATUS_LABELS).map(([value, label]) => ({ value, label })),
        value: (o) => o.ppoStatus,
      },
      {
        id: "stage",
        label: "Stage",
        options: (["Ongoing", "Completed", "Dates not recorded"] as Stage[]).map((s) => ({ value: s, label: s })),
        value: stageOf,
      },
      {
        id: "season",
        label: "Season",
        options: [...new Set(rows.map((o) => o.batch))]
          .sort((a, b) => b - a)
          .map((batch) => ({ value: String(batch), label: String(batch) })),
        value: (o) => String(o.batch),
      },
      {
        id: "branch",
        label: "Branch",
        options: unique(rows.map((o) => o.student?.branch)).map((v) => ({ value: v, label: v })),
        value: (o) => o.student?.branch,
      },
      {
        id: "degree",
        label: "Course",
        options: unique(rows.map((o) => o.student?.degree)).map((v) => ({ value: v, label: v })),
        value: (o) => o.student?.degree,
      },
      {
        id: "company",
        label: "Company",
        searchable: true,
        options: unique(rows.map((o) => o.company?.name)).map((v) => ({ value: v, label: v })),
        value: (o) => o.company?.name,
      },
    ],
    [rows],
  );

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Placement records</span>
          <h1>Update PPO status</h1>
          <p>
            An internship keeps its student out of on-campus drives until you record whether the company gave a PPO.
            No PPO frees the student; a received PPO is recorded as a placement.
          </p>
        </div>
      </section>

      {backendError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{backendError}</AlertDescription>
        </Alert>
      ) : null}
      {truncated ? (
        <Alert className="mb-4">
          <AlertDescription>Showing the first 500 internships. Filter placement records by season to reach the rest.</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert variant={message.type === "error" ? "destructive" : "success"} className="mb-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <section className="admin-metrics">
        <article>
          <div className="company-admin-name">
            <i style={{ background: "var(--badge-orange-bg)", color: "var(--orange)" }}>
              <Clock3 />
            </i>
          </div>
          <div>
            <small>PPO pending</small>
            <strong>{counts.pending}</strong>
            <b style={{ color: "var(--orange)" }}>Students held back from drives</b>
          </div>
        </article>
        <article>
          <div className="company-admin-name">
            <i style={{ background: "var(--badge-green-bg)", color: "var(--green)" }}>
              <CheckCircle2 />
            </i>
          </div>
          <div>
            <small>PPO received</small>
            <strong>{counts.received}</strong>
            <b style={{ color: "var(--green)" }}>Counted as placements</b>
          </div>
        </article>
        <article>
          <div className="company-admin-name">
            <i>
              <XCircle />
            </i>
          </div>
          <div>
            <small>No PPO</small>
            <strong>{counts.notReceived}</strong>
            <b>Back in the placement pool</b>
          </div>
        </article>
      </section>

      {selectedIds.size > 0 ? (
        <div className="bulk-action-bar">
          <span>
            Selected <strong>{selectedIds.size}</strong> internship{selectedIds.size === 1 ? "" : "s"}
          </span>
          <div className="items-center">
            <button className="reject" onClick={() => setMany("NOT_RECEIVED")} disabled={isPending}>
              No PPO for all
            </button>
            <Input
              type="number"
              min={0}
              step="any"
              value={bulkCtc}
              onChange={(input) => setBulkCtc(input.target.value)}
              placeholder="Shared annual CTC (₹)"
              aria-label="Annual CTC shared by the selected internships"
              className="h-8 w-[180px]"
            />
            <button className="select" onClick={() => setMany("RECEIVED")} disabled={isPending || !bulkCtc.trim()}>
              PPO received for all
            </button>
            <button onClick={() => setSelectedIds(new Set())} disabled={isPending}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <DataTable
        title="Internships"
        data={rows}
        columns={columns}
        filters={filters}
        // Opens on the work still to do; clearing the filter shows every internship.
        initialFilters={{ ppo: ["PENDING"] }}
        getRowId={(o) => o.id}
        searchText={(o) =>
          `${o.student?.name ?? ""} ${o.student?.rollNumber ?? ""} ${o.student?.branch ?? ""} ${o.company?.name ?? ""} ${o.jobTitle ?? ""}`
        }
        searchPlaceholder="Search student, roll number, or company"
        columnStorageKey="ppo-worklist"
        minWidth={1180}
        onViewChange={setView}
        leadingColumn={{
          header: (
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleSelectAll}
              aria-label="Select all internships on this page"
            />
          ),
          cell: (o) => (
            <input
              type="checkbox"
              checked={selectedIds.has(o.id)}
              onChange={() => toggleSelectOne(o.id)}
              aria-label={`Select ${studentName(o)}`}
            />
          ),
        }}
        emptyIcon={<Award />}
        emptyTitle={internships.length ? "Nothing matches these filters" : "No internships recorded"}
        emptyDescription={
          internships.length
            ? "Clear the PPO filter to see every internship, or adjust the season, branch, or course."
            : "Internships appear here once they are recorded, or once an NOC is approved."
        }
      />
    </div>
  );
}
