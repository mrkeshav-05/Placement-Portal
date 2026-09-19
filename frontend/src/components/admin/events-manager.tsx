"use client";

import { BriefcaseBusiness, Edit3, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteJobProfile, type JobProfileActionResult } from "@/app/admin/events/actions";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/job-profile-schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type AdminEventItem = {
  id: string;
  companyName: string;
  title: string;
  type: keyof typeof EMPLOYMENT_TYPE_LABELS;
  locations: string[];
  minCGPA: number;
  allowedBranches: string[];
  batch: number;
  placementYear: number;
  registrationDeadline: string;
  status: "DRAFT" | "ACTIVE" | "ENDED";
  applicationCount: number;
};

const deadlineFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function EventsManager({
  events,
  canCreate,
  canUpdate,
  canDelete,
}: {
  events: AdminEventItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<JobProfileActionResult>({});

  async function remove(formData: FormData) {
    const nextResult = await deleteJobProfile(formData);
    setResult(nextResult);
    if (nextResult.success) router.refresh();
  }

  const columns = useMemo<DataTableColumn<AdminEventItem>[]>(
    () => [
      {
        id: "role",
        header: "Event",
        width: "260px",
        sortValue: (event) => `${event.companyName} ${event.title}`,
        hideable: false,
        cell: (event) => (
          <span className="company-admin-name">
            <i>
              <BriefcaseBusiness />
            </i>
            <span>
              <strong>
                {event.companyName} · {event.title}
              </strong>
              <small>
                {EMPLOYMENT_TYPE_LABELS[event.type]} · {event.locations.join(" / ")}
              </small>
            </span>
          </span>
        ),
      },
      {
        id: "eligibility",
        header: "Eligibility",
        width: "200px",
        sortValue: (event) => event.minCGPA,
        cell: (event) => (
          <span>
            Batch {event.batch} · CGPA {event.minCGPA}+
            <br />
            <small>{event.allowedBranches.join(", ")}</small>
          </span>
        ),
      },
      {
        id: "season",
        header: "Placement year",
        width: "140px",
        sortValue: (event) => event.placementYear,
        cell: (event) => <span>{event.placementYear}</span>,
      },
      {
        id: "deadline",
        header: "Deadline",
        width: "190px",
        sortValue: (event) => new Date(event.registrationDeadline),
        cell: (event) => (
          <span>
            <b className={`cell-status ${event.status.toLowerCase()}`}>{event.status}</b>
            <br />
            <small>{deadlineFormat.format(new Date(event.registrationDeadline))}</small>
          </span>
        ),
      },
      {
        id: "applications",
        header: "Applications",
        width: "130px",
        sortValue: (event) => event.applicationCount,
        cell: (event) => <span>{event.applicationCount}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        width: "110px",
        hideable: false,
        cell: (event) => (
          <span className="row-actions">
            {canUpdate ? (
              <Link
                href={`/admin/events/${event.id}/edit`}
                title={`Edit ${event.title}`}
                aria-label={`Edit ${event.title}`}
              >
                <Edit3 />
              </Link>
            ) : null}
            <form action={remove}>
              <input type="hidden" name="jobProfileId" value={event.id} />
              <button
                title={
                  event.applicationCount
                    ? "Events with applications cannot be deleted"
                    : `Delete ${event.title}`
                }
                aria-label={`Delete ${event.title}`}
                disabled={!canDelete || event.applicationCount > 0}
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
    [canUpdate, canDelete],
  );

  const filters = useMemo<DataTableFilter<AdminEventItem>[]>(() => {
    const seasons = Array.from(new Set(events.map((event) => event.placementYear))).sort(
      (a, b) => b - a,
    );
    const batches = Array.from(new Set(events.map((event) => event.batch))).sort((a, b) => b - a);
    const types = Array.from(new Set(events.map((event) => event.type))).sort((a, b) =>
      EMPLOYMENT_TYPE_LABELS[a].localeCompare(EMPLOYMENT_TYPE_LABELS[b]),
    );

    return [
      {
        id: "status",
        label: "Status",
        value: (event) => event.status,
        options: [
          { value: "ACTIVE", label: "Active" },
          { value: "DRAFT", label: "Draft" },
          { value: "ENDED", label: "Ended" },
        ],
      },
      {
        id: "placementYear",
        label: "Placement year",
        value: (event) => String(event.placementYear),
        options: seasons.map((season) => ({ value: String(season), label: String(season) })),
      },
      {
        id: "batch",
        label: "Batch",
        value: (event) => String(event.batch),
        options: batches.map((batch) => ({ value: String(batch), label: String(batch) })),
      },
      {
        id: "type",
        label: "Type",
        value: (event) => event.type,
        options: types.map((type) => ({ value: type, label: EMPLOYMENT_TYPE_LABELS[type] })),
      },
    ];
  }, [events]);

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Opportunity management</span>
          <h1>All events</h1>
          <p>Every company event, its eligibility rules, deadline, and publishing status.</p>
        </div>
        {canCreate ? (
          <Link href="/admin/events/add">
            <Plus />
            Add event
          </Link>
        ) : null}
      </section>
      {result.success ? <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert> : null}
      {result.error ? <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      <DataTable
        title="Company Events"
        data={events}
        columns={columns}
        getRowId={(event) => event.id}
        searchText={(event) => `${event.companyName} ${event.title} ${event.locations.join(" ")}`}
        searchPlaceholder="Search company, role, or place of posting"
        filters={filters}
        columnStorageKey="events"
        minWidth={1040}
        emptyIcon={<BriefcaseBusiness />}
        emptyTitle={events.length ? "No matching events" : "No events yet"}
        emptyDescription={
          events.length
            ? "Change the search or status filter."
            : "Add a company, then create its first company event."
        }
      />
    </div>
  );
}
