"use client";

import { Award, Download, Edit3, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  deleteOfferAction,
  saveOfferAction,
  type OfferActionResult,
} from "@/app/admin/placement-records/actions";
import {
  formatRupees,
  formatStipend,
  isCtcType,
  OFFER_SOURCE_LABELS,
  OFFER_STATUS_LABELS,
  OFFER_TYPE_LABELS,
  type OfferSource,
  type OfferStatus,
  type OfferType,
} from "@/lib/offer-schema";
import { CompanySelect } from "@/components/common/company-select";
import { COMPANY_OPTIONS } from "@/lib/company-options";
import { PortalDialog } from "@/components/common/portal-dialog";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type StudentOption = {
  id: string;
  name: string | null;
  email: string | null;
  rollNumber: string | null;
  branch: string | null;
  degree: string | null;
  batch: number | null;
};

export type CompanyOption = { id: string; name: string };

export type JobOption = {
  id: string;
  title: string;
  companyId: string;
  companyName: string | null;
  batch: number;
};

export type OfferRecord = {
  id: string;
  userId: string;
  companyId: string;
  jobProfileId: string | null;
  jobTitle: string | null;
  type: OfferType;
  status: OfferStatus;
  source: OfferSource;
  batch: number;
  ctc: number | null;
  stipend: number | null;
  location: string | null;
  offeredAt: string | null;
  joiningDate: string | null;
  remarks: string | null;
  student: {
    id: string;
    name: string | null;
    email: string | null;
    rollNumber: string | null;
    branch: string | null;
    degree: string | null;
  } | null;
  company: { id: string; name: string } | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

/** `<input type="date">` wants a plain yyyy-mm-dd in the viewer's own day. */
function dateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function studentLabel(student: StudentOption) {
  const name = student.name ?? student.email ?? "Unnamed student";
  const roll = student.rollNumber ? ` (${student.rollNumber})` : "";
  const batch = student.batch ? ` · ${student.batch}` : "";
  return `${name}${roll}${batch}`;
}

export function PlacementRecordsManager({
  offers,
  students,
  companies,
  jobs,
  backendError,
  canCreate,
  canUpdate,
  canDelete,
}: {
  offers: OfferRecord[];
  students: StudentOption[];
  companies: CompanyOption[];
  jobs: JobOption[];
  backendError: string | null;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<OfferRecord | null | undefined>(undefined);
  const [formType, setFormType] = useState<OfferType>("FTE");
  const [formSource, setFormSource] = useState<OfferSource>("ON_CAMPUS");
  const [formCompanyId, setFormCompanyId] = useState("");
  // Radix rejects an empty option value, so "not from a drive" is held as a
  // sentinel here and posted back as the empty string the action expects.
  const [jobProfileId, setJobProfileId] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<OfferActionResult>({});

  const seasons = useMemo(
    () => [...new Set(offers.map((offer) => offer.batch))].sort((a, b) => b - a),
    [offers],
  );

  function openForm(offer: OfferRecord | null) {
    setResult({});
    setFormType(offer?.type ?? "FTE");
    setFormSource(offer?.source ?? "ON_CAMPUS");
    setFormCompanyId(offer?.companyId ?? "");
    setJobProfileId(offer?.jobProfileId ?? "");
    setEditing(offer);
  }

  function selectFormSource(next: OfferSource) {
    setFormSource(next);
    if (next !== "ON_CAMPUS") setJobProfileId("");
  }

  async function submit(formData: FormData) {
    setSaving(true);
    const next = await saveOfferAction(formData);
    setResult(next);
    setSaving(false);
    if (next.success) {
      setEditing(undefined);
      router.refresh();
    }
  }

  async function remove(formData: FormData) {
    const next = await deleteOfferAction(formData);
    setResult(next);
    if (next.success) router.refresh();
  }

  const columns = useMemo<DataTableColumn<OfferRecord>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: "220px",
        hideable: false,
        sticky: true,
        sortValue: (offer) => offer.student?.name ?? offer.student?.email,
        cell: (offer) => (
          <span className="company-admin-name">
            <i>
              <Award />
            </i>
            <span>
              <strong>{offer.student?.name ?? "Student"}</strong>
              <small>{offer.student?.rollNumber ?? "Profile incomplete"}</small>
            </span>
          </span>
        ),
      },
      {
        id: "degree",
        header: "Degree",
        width: "110px",
        sortValue: (offer) => offer.student?.degree,
        cell: (offer) => offer.student?.degree ?? <span className="dt-muted">—</span>,
      },
      {
        id: "branch",
        header: "Branch",
        width: "120px",
        sortValue: (offer) => offer.student?.branch,
        cell: (offer) => offer.student?.branch ?? <span className="dt-muted">—</span>,
      },
      {
        id: "company",
        header: "Company",
        width: "170px",
        sortValue: (offer) => offer.company?.name,
        cell: (offer) => <strong>{offer.company?.name ?? "—"}</strong>,
      },
      {
        id: "type",
        header: "Type",
        width: "150px",
        sortValue: (offer) => offer.type,
        cell: (offer) => <span className="cell-tag">{OFFER_TYPE_LABELS[offer.type]}</span>,
      },
      {
        id: "source",
        header: "Source",
        width: "160px",
        sortValue: (offer) => offer.source,
        cell: (offer) => <span className="cell-tag">{OFFER_SOURCE_LABELS[offer.source]}</span>,
      },
      {
        id: "jobTitle",
        header: "Job title",
        width: "200px",
        sortValue: (offer) => offer.jobTitle,
        cell: (offer) =>
          offer.jobTitle ?? <span className="dt-muted">Recorded off-portal</span>,
      },
      {
        id: "package",
        header: "Package",
        width: "140px",
        // Sorted on the amount, not on the formatted rupee string, and a CTC
        // is never compared against a monthly stipend.
        sortValue: (offer) => (isCtcType(offer.type) ? offer.ctc : offer.stipend),
        cell: (offer) => (
          <strong>
            {isCtcType(offer.type) ? formatRupees(offer.ctc) : formatStipend(offer.stipend)}
          </strong>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "150px",
        sortValue: (offer) => offer.status,
        cell: (offer) => (
          <span className="dt-primary">
            <b className={`cell-status ${offer.status.toLowerCase()}`}>
              {OFFER_STATUS_LABELS[offer.status]}
            </b>
            <small>offered {formatDate(offer.offeredAt)}</small>
          </span>
        ),
      },
      {
        id: "batch",
        header: "Season",
        width: "100px",
        sortValue: (offer) => offer.batch,
        cell: (offer) => <span>{offer.batch}</span>,
      },
      {
        id: "joiningDate",
        header: "Joining",
        width: "120px",
        defaultHidden: true,
        sortValue: (offer) => (offer.joiningDate ? new Date(offer.joiningDate) : null),
        cell: (offer) => formatDate(offer.joiningDate),
      },
      {
        id: "location",
        header: "Location",
        width: "140px",
        defaultHidden: true,
        sortValue: (offer) => offer.location,
        cell: (offer) => offer.location ?? <span className="dt-muted">Not recorded</span>,
      },
      // Omitted entirely, rather than rendered empty, for a viewer with
      // neither grant (PLACEMENT_VOLUNTEER, FACULTY): an actions column with
      // nothing in it reads as a bug, not as "you can't do anything here".
      ...(canUpdate || canDelete
        ? [
            {
              id: "actions",
              header: "Actions",
              width: "110px",
              hideable: false,
              cell: (offer: OfferRecord) => (
                <span className="row-actions">
                  {canUpdate ? (
                    <button
                      title={`Edit the offer for ${offer.student?.name ?? "this student"}`}
                      aria-label={`Edit the offer for ${offer.student?.name ?? "this student"}`}
                      onClick={() => openForm(offer)}
                    >
                      <Edit3 />
                    </button>
                  ) : null}
                  {canDelete ? (
                    <form action={remove}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <button title="Delete this placement record" aria-label="Delete this placement record">
                        <Trash2 />
                      </button>
                    </form>
                  ) : null}
                </span>
              ),
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete],
  );

  const filters = useMemo<DataTableFilter<OfferRecord>[]>(
    () => [
      {
        id: "season",
        label: "Season",
        options: seasons.map((season) => ({ value: String(season), label: String(season) })),
        value: (offer) => String(offer.batch),
      },
      {
        id: "company",
        label: "Company",
        // Built from the recorded offers, not the full company list: filtering
        // by a company with no records would only ever empty the table.
        options: [...new Set(offers.map((offer) => offer.company?.name).filter(Boolean))]
          .sort()
          .map((name) => ({ value: name as string, label: name as string })),
        value: (offer) => offer.company?.name ?? "",
      },
      {
        id: "degree",
        label: "Degree",
        options: [...new Set(offers.map((offer) => offer.student?.degree).filter(Boolean))]
          .sort()
          .map((degree) => ({ value: degree as string, label: degree as string })),
        value: (offer) => offer.student?.degree ?? "",
      },
      {
        id: "type",
        label: "Type",
        options: Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        value: (offer) => offer.type,
      },
      {
        id: "source",
        label: "Source",
        options: Object.entries(OFFER_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
        value: (offer) => offer.source,
      },
      {
        id: "status",
        label: "Status",
        options: Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
        value: (offer) => offer.status,
      },
    ],
    [seasons, offers],
  );

  const createDisabledReason = backendError
    ? "The API service is unreachable."
    : !students.length
      ? "Register a student before recording an offer."
      : !companies.length
        ? "Add a company before recording an offer."
        : null;

  /**
   * The table as the office reads it, not as it is stored: labels rather than
   * enum values, and one Package column holding whichever of CTC or stipend
   * the row's type uses.
   */
  function downloadRecords() {
    if (!offers.length) return;
    const rows = offers.map((offer, index) => ({
      "S.No": index + 1,
      Student: offer.student?.name ?? "",
      "Roll Number": offer.student?.rollNumber ?? "",
      Email: offer.student?.email ?? "",
      Degree: offer.student?.degree ?? "",
      Branch: offer.student?.branch ?? "",
      Company: offer.company?.name ?? "",
      Type: OFFER_TYPE_LABELS[offer.type],
      Source: OFFER_SOURCE_LABELS[offer.source],
      "Job Title": offer.jobTitle ?? "",
      Package: isCtcType(offer.type)
        ? formatRupees(offer.ctc)
        : formatStipend(offer.stipend),
      Status: OFFER_STATUS_LABELS[offer.status],
      Season: offer.batch,
      Location: offer.location ?? "",
      "Offer Date": formatDate(offer.offeredAt),
      "Joining Date": formatDate(offer.joiningDate),
      Notes: offer.remarks ?? "",
    }));

    // Loaded on demand: the sheet writer is far larger than this screen.
    import("xlsx").then((XLSX) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Placement records");
      XLSX.writeFile(workbook, "placement-records.xlsx");
    });
  }

  const isExistingCompany = companies.some((company) => company.id === formCompanyId);

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Placement records</span>
          <h1>Offers</h1>
          <p>Every placement, pre-placement, and internship offer. The dashboard is built from these rows.</p>
        </div>
        {canCreate ? (
          <div className="admin-heading-actions">
            {/* One record at a time, or a whole drive's outcome at once. */}
            <Link className="secondary" href="/admin/placement-records/add">
              <Users />
              Add in bulk
            </Link>
            <button
              disabled={Boolean(createDisabledReason)}
              title={createDisabledReason ?? "Add placement record"}
              onClick={() => openForm(null)}
            >
              <Plus />
              Add record
            </button>
          </div>
        ) : null}
      </section>

      {backendError ? <Alert variant="destructive" className="mt-4"><AlertDescription>{backendError}</AlertDescription></Alert> : null}
      {result.success ? <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert> : null}
      {result.error ? <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert> : null}

      <DataTable
        title="Offer Records"
        data={offers}
        columns={columns}
        filters={filters}
        actions={
          <Button type="button" variant="outline" disabled={!offers.length} onClick={downloadRecords}>
            <Download />
            Download placement records
          </Button>
        }
        getRowId={(offer) => offer.id}
        searchText={(offer) =>
          `${offer.student?.name ?? ""} ${offer.student?.rollNumber ?? ""} ${
            offer.student?.email ?? ""
          } ${offer.company?.name ?? ""} ${offer.jobTitle ?? ""}`
        }
        searchPlaceholder="Search student, roll number, or company"
        columnStorageKey="placement-records"
        minWidth={1080}
        initialSort={{ columnId: "batch", direction: "desc" }}
        emptyIcon={<Award />}
        emptyTitle={offers.length ? "No matching records" : "No placement records yet"}
        emptyDescription={
          offers.length
            ? "Try changing your search or filters."
            : "Add the season's first offer; the dashboard fills in from here."
        }
      />

      {editing !== undefined ? (
        <PortalDialog
          onClose={() => setEditing(undefined)}
          eyebrow="Placement record"
          title={editing ? "Edit offer" : "Add offer"}
          className="job-profile-modal sm:max-w-[900px]"
        >
          <form className="grid gap-3" action={submit}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            {/* The sentinel never leaves the browser: the action still reads an
                empty string when the offer is not tied to a portal drive. */}
            <input type="hidden" name="jobProfileId" value={jobProfileId} />
            {/* `formCompanyId` holds either a real company's id or a plain
                name with no Company row yet (an off-campus/hackathon
                recruiter) — only one of these two fields is ever meaningful. */}
            <input
              type="hidden"
              name="companyId"
              value={isExistingCompany ? formCompanyId : ""}
            />
            <input
              type="hidden"
              name="companyName"
              value={isExistingCompany ? "" : formCompanyId}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="offer-student">Student</Label>
                <Select name="userId" required defaultValue={editing?.userId ?? undefined}>
                  <SelectTrigger id="offer-student" className="w-full">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {studentLabel(student)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-company">Company</Label>
                <CompanySelect
                  id="offer-company"
                  options={companies}
                  suggestions={COMPANY_OPTIONS}
                  value={formCompanyId}
                  onChange={setFormCompanyId}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-source">Recruitment source</Label>
                <Select
                  name="source"
                  value={formSource}
                  onValueChange={(value) => selectFormSource(value as OfferSource)}
                >
                  <SelectTrigger id="offer-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OFFER_SOURCE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-drive">Drive (optional)</Label>
                <Select
                  value={jobProfileId || "__none"}
                  onValueChange={(value) => setJobProfileId(value === "__none" ? "" : value)}
                  disabled={formSource !== "ON_CAMPUS"}
                >
                  <SelectTrigger id="offer-drive" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not from a portal drive</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.companyName ? `${job.companyName} · ` : ""}
                        {job.title} ({job.batch})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-type">Offer type</Label>
                <Select
                  name="type"
                  value={formType}
                  onValueChange={(value) => setFormType(value as OfferType)}
                >
                  <SelectTrigger id="offer-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OFFER_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-status">Status</Label>
                <Select name="status" defaultValue={editing?.status ?? "OFFERED"}>
                  <SelectTrigger id="offer-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-job-title">Job title</Label>
                <Input
                  id="offer-job-title"
                  name="jobTitle"
                  maxLength={200}
                  defaultValue={editing?.jobTitle ?? ""}
                  placeholder="Associate Engineer"
                />
                <small className="text-muted-foreground text-xs">
                  Leave empty to show the linked drive&apos;s title instead.
                </small>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-batch">Season (graduating batch)</Label>
                <Input
                  id="offer-batch"
                  name="batch"
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  defaultValue={editing?.batch ?? new Date().getFullYear() + 1}
                />
              </div>
              {isCtcType(formType) ? (
                <div className="grid gap-2">
                  <Label htmlFor="offer-ctc">Annual CTC (₹)</Label>
                  <Input
                    id="offer-ctc"
                    name="ctc"
                    type="number"
                    min={0}
                    step="any"
                    required
                    defaultValue={editing?.ctc ?? ""}
                    placeholder="1800000"
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="offer-stipend">Monthly stipend (₹)</Label>
                  <Input
                    id="offer-stipend"
                    name="stipend"
                    type="number"
                    min={0}
                    step="any"
                    required
                    defaultValue={editing?.stipend ?? ""}
                    placeholder="75000"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="offer-location">Location</Label>
                <Input
                  id="offer-location"
                  name="location"
                  maxLength={200}
                  defaultValue={editing?.location ?? ""}
                  placeholder="Bengaluru"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-offered-at">Offer date</Label>
                <Input
                  id="offer-offered-at"
                  name="offeredAt"
                  type="date"
                  defaultValue={dateInputValue(editing?.offeredAt ?? null)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offer-joining-date">Joining date</Label>
                <Input
                  id="offer-joining-date"
                  name="joiningDate"
                  type="date"
                  defaultValue={dateInputValue(editing?.joiningDate ?? null)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="offer-remarks">Remarks</Label>
                <Textarea
                  id="offer-remarks"
                  name="remarks"
                  rows={3}
                  maxLength={2000}
                  defaultValue={editing?.remarks ?? ""}
                  placeholder="Anything the office needs on file about this offer."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add record"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      ) : null}
    </div>
  );
}
