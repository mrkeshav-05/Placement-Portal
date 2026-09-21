"use client";

import {
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileBadge,
  FileCheck2,
  FileText,
  FileUp,
  MapPin,
  ShieldCheck,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  approveNocAction,
  rejectNocAction,
  uploadNocDocumentAction,
  verifyNocDocumentAction,
  type NocActionResult,
} from "@/app/admin/noc-requests/actions";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** One labelled panel in the inspection dialog. */
function DetailBox({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted rounded-[10px] border px-3.5 py-3">
      <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

export type AdminNocItem = {
  id: string;
  userId: string;
  studentName: string | null;
  studentEmail: string | null;
  rollNumber: string | null;
  branch: string | null;
  batch: number | null;
  degree: string | null;
  cgpa: number | null;
  contactNumber: string | null;
  company: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  /** Written by the student when submitting. */
  message: string | null;
  /** Written by the placement cell when approving or rejecting. */
  adminRemarks: string | null;
  documentUrl: string | null;
  /** Whether the offer behind the request is on- or off-campus. */
  source: "ON_CAMPUS" | "OFF_CAMPUS" | string;
  /** The student's own proof of an off-campus offer. */
  offCampusProofUrl: string | null;
  /** An independent marker, not a workflow gate — see the schema comment. */
  verifiedByPlacementTeam: boolean;
  /** False means this row only records dates/company; no decision was made. */
  nocRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * The status a row displays as, distinct from its stored `status`: a
 * not-required row is stored APPROVED (nothing was left to decide) but must
 * never read as a real approval.
 */
function displayStatus(item: AdminNocItem): "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" {
  if (item.nocRequired === false) return "NOT_REQUIRED";
  if (item.status === "PENDING" || item.status === "APPROVED" || item.status === "REJECTED") {
    return item.status;
  }
  return "PENDING";
}

export function NocRequestsManager({
  nocRequests,
  canDecide = true,
}: {
  nocRequests: AdminNocItem[];
  canPersist?: boolean;
  /** False for a Placement Volunteer: they can see every request but not the
   *  decision status, and cannot approve, reject, or upload a certificate. */
  canDecide?: boolean;
}) {
  const router = useRouter();
  const [detailItem, setDetailItem] = useState<AdminNocItem | null>(null);
  const [approvingItem, setApprovingItem] = useState<AdminNocItem | null>(null);
  const [rejectingItem, setRejectingItem] = useState<AdminNocItem | null>(null);
  const [uploadingItem, setUploadingItem] = useState<AdminNocItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [result, setResult] = useState<NocActionResult>({});
  const [isPending, startTransition] = useTransition();

  const metrics = useMemo(() => {
    const total = nocRequests.length;
    const pending = nocRequests.filter((n) => displayStatus(n) === "PENDING").length;
    // Real approvals only — a not-required row's stored status is also
    // APPROVED, but nobody decided it, so it is counted apart from this.
    const approved = nocRequests.filter((n) => displayStatus(n) === "APPROVED").length;
    const rejected = nocRequests.filter((n) => displayStatus(n) === "REJECTED").length;
    const notRequired = nocRequests.filter((n) => displayStatus(n) === "NOT_REQUIRED").length;
    return { total, pending, approved, rejected, notRequired };
  }, [nocRequests]);

  const columns = useMemo<DataTableColumn<AdminNocItem>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: "220px",
        hideable: false,
        sortValue: (item) => item.studentName || item.rollNumber || item.studentEmail,
        cell: (item) => (
          <span className="dt-primary">
            <strong>{item.studentName || item.rollNumber || "Student"}</strong>
            <small>
              {[item.rollNumber, item.branch, item.batch ? `Batch '${String(item.batch).slice(-2)}` : null]
                .filter(Boolean)
                .join(" · ") || item.studentEmail}
            </small>
          </span>
        ),
      },
      {
        id: "company",
        header: "Company & Location",
        width: "180px",
        sortValue: (item) => item.company,
        cell: (item) => (
          <span className="dt-primary">
            <strong style={{ color: "#0B2545" }}>{item.company}</strong>
            <small>{[item.city, item.state].filter(Boolean).join(", ")}</small>
          </span>
        ),
      },
      {
        id: "source",
        header: "Source",
        width: "110px",
        sortValue: (item) => item.source,
        cell: (item) =>
          item.source === "OFF_CAMPUS" ? (
            <span className="cell-tag" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              {item.offCampusProofUrl && item.verifiedByPlacementTeam ? (
                <ShieldCheck size={11} style={{ color: "var(--green)" }} />
              ) : null}
              Off-campus
            </span>
          ) : (
            <span className="cell-tag">On-campus</span>
          ),
      },
      {
        id: "startDate",
        header: "Start Date",
        width: "130px",
        sortValue: (item) => new Date(item.startDate),
        cell: (item) => (
          <span className="dt-primary">
            {new Date(item.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        ),
      },
      {
        id: "endDate",
        header: "End Date",
        width: "130px",
        sortValue: (item) => new Date(item.endDate),
        cell: (item) => (
          <span className="dt-primary">
            {new Date(item.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        ),
      },
      // Whether a request was approved, rejected, or is pending is a decision
      // the Placement Volunteer role never gets to make (see canDecide above),
      // so the column that reveals it doesn't render for them either.
      ...(canDecide
        ? [
            {
              id: "status",
              header: "Status",
              width: "120px",
              sortValue: (item: AdminNocItem) => displayStatus(item),
              cell: (item: AdminNocItem) => {
                const state = displayStatus(item);
                return (
                  <>
                    {state === "NOT_REQUIRED" && (
                      <span className="cell-status" style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "var(--surface-alt)", color: "var(--muted-foreground)" }}>
                        <FileBadge size={11} /> Not required
                      </span>
                    )}
                    {state === "PENDING" && (
                      <span className="cell-status pending" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Clock3 size={11} /> Pending
                      </span>
                    )}
                    {state === "APPROVED" && (
                      <span className="cell-status" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={11} /> Approved
                      </span>
                    )}
                    {state === "REJECTED" && (
                      <span
                        className="cell-status"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "var(--badge-red-bg)",
                          color: "var(--badge-red-text)",
                        }}
                      >
                        <XCircle size={11} /> Rejected
                      </span>
                    )}
                  </>
                );
              },
            } satisfies DataTableColumn<AdminNocItem>,
          ]
        : []),
      {
        id: "certificate",
        header: "Certificate",
        width: "120px",
        sortValue: (item) => Boolean(item.documentUrl),
        cell: (item) =>
          item.documentUrl ? (
            <button
              type="button"
              onClick={() => setPreviewDoc({ url: `/api/noc-documents/${item.id}`, title: `NOC - ${item.company} (${item.studentName || item.rollNumber})` })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "var(--badge-green-bg)",
                color: "var(--badge-green-text)",
                border: 0,
                padding: "4px 8px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FileCheck2 size={12} /> View PDF
            </button>
          ) : (
            <small className="dt-muted">No document</small>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "260px",
        align: "right",
        hideable: false,
        cell: (item) => (
          <span style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setDetailItem(item)}
              title="View full request details"
              style={{
                border: 0,
                background: "var(--surface-alt)",
                color: "var(--blue)",
                borderRadius: "8px",
                padding: "6px 9px",
                fontSize: "11px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
              }}
            >
              <Eye size={13} /> Details
            </button>

            {canDecide && item.status === "PENDING" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setResult({});
                    setApprovingItem(item);
                  }}
                  title="Approve NOC request"
                  style={{
                    border: 0,
                    background: "var(--badge-green-bg)",
                    color: "var(--green)",
                    borderRadius: "8px",
                    padding: "6px 9px",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <CheckCircle2 size={13} /> Approve
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResult({});
                    setRejectingItem(item);
                  }}
                  title="Reject NOC request"
                  style={{
                    border: 0,
                    background: "var(--badge-red-bg)",
                    color: "var(--badge-red-text)",
                    borderRadius: "8px",
                    padding: "6px 9px",
                    fontSize: "11px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <XCircle size={13} /> Reject
                </button>
              </>
            )}

            {canDecide && item.status === "APPROVED" && item.nocRequired !== false && (
              <button
                type="button"
                onClick={() => {
                  setResult({});
                  setUploadingItem(item);
                }}
                title="Upload/replace certificate PDF"
                style={{
                  border: 0,
                  background: "var(--surface-alt)",
                  color: "var(--ink)",
                  borderRadius: "8px",
                  padding: "6px 9px",
                  fontSize: "11px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                }}
              >
                <FileUp size={13} /> {item.documentUrl ? "Replace" : "Upload"}
              </button>
            )}
          </span>
        ),
      },
    ],
    [canDecide],
  );

  const batches = useMemo(
    () => Array.from(new Set(nocRequests.map((item) => item.batch).filter((b): b is number => b != null))).sort(
      (a, b) => b - a,
    ),
    [nocRequests],
  );
  const branches = useMemo(
    () => Array.from(new Set(nocRequests.map((item) => item.branch).filter((b): b is string => Boolean(b)))).sort(),
    [nocRequests],
  );
  const degrees = useMemo(
    () => Array.from(new Set(nocRequests.map((item) => item.degree).filter((d): d is string => Boolean(d)))).sort(),
    [nocRequests],
  );

  const filters = useMemo<DataTableFilter<AdminNocItem>[]>(
    () => [
      {
        id: "course",
        label: "Course",
        options: degrees.map((degree) => ({ value: degree, label: degree })),
        value: (item) => item.degree,
      },
      {
        id: "batch",
        label: "Batch",
        options: batches.map((batch) => ({ value: String(batch), label: String(batch) })),
        value: (item) => (item.batch != null ? String(item.batch) : null),
      },
      {
        id: "branch",
        label: "Branch",
        options: branches.map((branch) => ({ value: branch, label: branch })),
        value: (item) => item.branch,
      },
      {
        id: "source",
        label: "Source",
        options: [
          { value: "ON_CAMPUS", label: "On-campus" },
          { value: "OFF_CAMPUS", label: "Off-campus" },
        ],
        value: (item) => item.source,
      },
      // Same admin-only rule as the Status column: a Placement Volunteer can
      // filter by who the request is about, but not by the decision made.
      ...(canDecide
        ? [
            {
              id: "status",
              label: "Status",
              options: [
                { value: "PENDING", label: "Pending Review" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "NOT_REQUIRED", label: "Not Required" },
              ],
              value: (item: AdminNocItem) => displayStatus(item),
            } satisfies DataTableFilter<AdminNocItem>,
          ]
        : []),
    ],
    [batches, branches, degrees, canDecide],
  );

  function handleApprove(formData: FormData) {
    setResult({});
    startTransition(async () => {
      // Check if a file was selected
      const file = formData.get("certificateFile") as File | null;
      let docUrl = formData.get("documentUrl") as string | null;

      if (file && file.size > 0) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        uploadFormData.append("nocId", approvingItem!.id);
        const uploadRes = await uploadNocDocumentAction(uploadFormData);
        if (uploadRes.error) {
          setResult({ error: uploadRes.error });
          return;
        }
        if (uploadRes.url) {
          docUrl = uploadRes.url;
        }
      }

      const approveFormData = new FormData();
      approveFormData.append("nocId", approvingItem!.id);
      if (formData.get("adminRemarks")) {
        approveFormData.append("adminRemarks", formData.get("adminRemarks") as string);
      }
      if (docUrl) {
        approveFormData.append("documentUrl", docUrl);
      }

      const res = await approveNocAction(approveFormData);
      setResult(res);
      if (res.success) {
        setApprovingItem(null);
        router.refresh();
      }
    });
  }

  function handleReject(formData: FormData) {
    setResult({});
    startTransition(async () => {
      const res = await rejectNocAction(formData);
      setResult(res);
      if (res.success) {
        setRejectingItem(null);
        router.refresh();
      }
    });
  }

  function handleUploadDoc(formData: FormData) {
    setResult({});
    startTransition(async () => {
      const uploadRes = await uploadNocDocumentAction(formData);
      if (uploadRes.error) {
        setResult({ error: uploadRes.error });
      } else {
        setResult({ success: "Signed NOC certificate uploaded successfully." });
        setUploadingItem(null);
        router.refresh();
      }
    });
  }

  function handleVerifyToggle(item: AdminNocItem, verified: boolean) {
    setVerifyingId(item.id);
    startTransition(async () => {
      const res = await verifyNocDocumentAction(item.id, verified);
      setVerifyingId(null);
      if (res.error) {
        setResult({ error: res.error });
        return;
      }
      // Optimistic: keep the inspection dialog in sync without waiting on the
      // table's own refresh, since it's likely still open.
      setDetailItem((current) =>
        current && current.id === item.id ? { ...current, verifiedByPlacementTeam: verified } : current,
      );
      router.refresh();
    });
  }

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Management</span>
          <h1>NOC Requests</h1>
          <p>Review, approve, or reject student internship and off-campus training NOC requests.</p>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="admin-metrics">
        <article>
          <div className="metric-icon violet">
            <FileText size={20} />
          </div>
          <div>
            <small>Total Requests</small>
            <strong>{metrics.total}</strong>
            <b>All-time student submissions</b>
          </div>
        </article>

        <article>
          <div className="metric-icon" style={{ background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" }}>
            <Clock3 size={20} />
          </div>
          <div>
            <small>Pending Review</small>
            <strong>{metrics.pending}</strong>
            <b>Awaiting decision</b>
          </div>
        </article>

        <article>
          <div className="metric-icon" style={{ background: "var(--badge-green-bg)", color: "var(--badge-green-text)" }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <small>Approved</small>
            <strong>{metrics.approved}</strong>
            <b>
              Certificates issued
              {metrics.notRequired > 0 ? ` · ${metrics.notRequired} recorded, no review needed` : ""}
            </b>
          </div>
        </article>

        <article>
          <div className="metric-icon" style={{ background: "var(--badge-red-bg)", color: "var(--badge-red-text)" }}>
            <XCircle size={20} />
          </div>
          <div>
            <small>Rejected</small>
            <strong>{metrics.rejected}</strong>
            <b>Ineligible / declined</b>
          </div>
        </article>
      </section>

      {/* Result feedback */}
      {result.success && <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert>}
      {result.error && <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert>}

      <DataTable
        title="NOC Requests"
        data={nocRequests}
        columns={columns}
        getRowId={(item) => item.id}
        searchText={(item) =>
          `${item.studentName ?? ""} ${item.rollNumber ?? ""} ${item.studentEmail ?? ""} ${item.company} ${item.city} ${item.state} ${item.message ?? ""} ${item.adminRemarks ?? ""}`
        }
        searchPlaceholder="Search by student name, roll number, email, company, city..."
        filters={filters}
        columnStorageKey="noc-requests"
        minWidth={1160}
        emptyIcon={<FileText />}
        emptyTitle="No NOC requests found"
        emptyDescription={
          nocRequests.length
            ? "No student requests match your search filter."
            : "No NOC requests are currently registered in the database."
        }
      />

      {/* Details Modal */}
      {detailItem && (
        <PortalDialog
          onClose={() => setDetailItem(null)}
          eyebrow="Inspection"
          title="NOC Request Details"
          className="max-h-[88vh] overflow-y-auto sm:max-w-[680px]"
        >
          <div className="grid gap-3.5 text-xs">
            {/* Student info box */}
            <DetailBox
              label={
                <>
                  <User size={12} /> Student Information
                </>
              }
            >
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <div>
                  <strong className="block">{detailItem.studentName || "Name not recorded"}</strong>
                  <small className="text-muted-foreground">{detailItem.studentEmail}</small>
                </div>
                <div>
                  <span>Roll: <strong>{detailItem.rollNumber || "N/A"}</strong></span>
                  <span className="block">
                    Branch/Batch: <strong>{[detailItem.branch, detailItem.batch].filter(Boolean).join(" - ") || "N/A"}</strong>
                  </span>
                  {detailItem.cgpa !== null && <span>CGPA: <strong>{detailItem.cgpa}</strong></span>}
                </div>
              </div>
            </DetailBox>

            {/* Company & Location info */}
            <DetailBox
              label={
                <>
                  <MapPin size={12} /> Company &amp; Facility Address
                </>
              }
            >
              <strong className="mt-1.5 block text-[13px]">{detailItem.company}</strong>
              <p className="mt-1 leading-relaxed">
                {detailItem.address}<br />
                {[detailItem.city, detailItem.state, detailItem.pincode].filter(Boolean).join(", ")}
              </p>
            </DetailBox>

            {/* Dates & Status */}
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailBox
                label={
                  <>
                    <Calendar size={12} /> Training Timeline
                  </>
                }
              >
                <strong className="mt-1 block">
                  {new Date(detailItem.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} –{" "}
                  {new Date(detailItem.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </strong>
              </DetailBox>

              {canDecide && (
                <DetailBox label="Current Status">
                  <strong className="mt-1 block">
                    {displayStatus(detailItem) === "NOT_REQUIRED" ? "Not required" : detailItem.status}
                  </strong>
                </DetailBox>
              )}
            </div>

            <DetailBox label="Offer Source">
              <strong className="mt-1 block">
                {detailItem.source === "OFF_CAMPUS" ? "Off-campus" : "On-campus"}
              </strong>
            </DetailBox>

            {/* Student Remarks */}
            {detailItem.message && (
              <DetailBox label="Student Remarks / Statement of Purpose">
                <p className="mt-1 leading-relaxed italic">
                  &ldquo;{detailItem.message}&rdquo;
                </p>
              </DetailBox>
            )}

            {/* Placement cell remarks recorded with the decision */}
            {detailItem.adminRemarks && (
              <DetailBox label="Placement Cell Remarks">
                <p className="mt-1 leading-relaxed">{detailItem.adminRemarks}</p>
              </DetailBox>
            )}

            {/* Off-campus offer proof, with the placement team's verification toggle */}
            {detailItem.source === "OFF_CAMPUS" && detailItem.offCampusProofUrl && (
              <div className="rounded-[10px] border border-[var(--blue)] bg-[var(--badge-blue-bg)] px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong className="block text-[var(--badge-blue-text)]">Off-campus offer proof</strong>
                    <small className="text-muted-foreground">Submitted by the student with this request</small>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setPreviewDoc({ url: `/api/noc-offcampus-proof/${detailItem.id}`, title: `Offer proof - ${detailItem.company}` });
                    }}
                  >
                    <Eye /> View Document
                  </Button>
                </div>

                {/* An independent marker, not a workflow gate: the placement
                    team can check the document and flip this whenever — it is
                    never required before approving or rejecting. */}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--blue)]/20 pt-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--badge-blue-text)]">
                    <ShieldCheck size={13} /> Verified by placement team
                  </span>
                  {canDecide ? (
                    <Switch
                      checked={detailItem.verifiedByPlacementTeam}
                      disabled={verifyingId === detailItem.id}
                      onCheckedChange={(checked) => handleVerifyToggle(detailItem, checked)}
                    />
                  ) : (
                    <span className="text-muted-foreground text-[11px]">
                      {detailItem.verifiedByPlacementTeam ? "Yes" : "Not yet"}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Certificate preview button if attached */}
            {detailItem.documentUrl && (
              <div className="flex items-center justify-between rounded-[10px] border border-[var(--green)] bg-[var(--badge-green-bg)] px-3.5 py-3">
                <div>
                  <strong className="block text-[var(--badge-green-text)]">Signed Certificate Available</strong>
                  <small className="text-muted-foreground">Click to view or download document</small>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--green)] hover:bg-[var(--green)]/90"
                  onClick={() => {
                    setPreviewDoc({ url: `/api/noc-documents/${detailItem.id}`, title: `NOC - ${detailItem.company}` });
                  }}
                >
                  <Eye /> View Certificate
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </PortalDialog>
      )}

      {/* Approve Modal */}
      {approvingItem && (
        <PortalDialog
          onClose={() => setApprovingItem(null)}
          eyebrow={<span className="text-[var(--green)]">Decision</span>}
          title="Approve NOC Request"
          className="sm:max-w-[540px]"
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => { e.preventDefault(); handleApprove(new FormData(e.currentTarget)); }}
          >
            <input type="hidden" name="nocId" value={approvingItem.id} />

            <p className="text-muted-foreground text-xs">
              Approving NOC for <strong>{approvingItem.studentName || approvingItem.rollNumber}</strong> at <strong>{approvingItem.company}</strong>.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="noc-approve-remarks">Approval remarks / notes (optional)</Label>
              <Textarea
                id="noc-approve-remarks"
                name="adminRemarks"
                rows={3}
                placeholder="e.g. Approved subject to maintaining minimum academic attendance..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="noc-approve-certificate">Upload signed NOC Certificate PDF (optional)</Label>
              <Input
                id="noc-approve-certificate"
                type="file"
                name="certificateFile"
                accept="application/pdf"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApprovingItem(null)}>
                Cancel
              </Button>
              {/* Green, to pair with the red on the reject dialog: the two
                  decisions have to be distinguishable at a glance. */}
              <Button
                type="submit"
                disabled={isPending}
                className="bg-[var(--green)] hover:bg-[var(--green)]/90"
              >
                <CheckCircle2 />
                {isPending ? "Approving..." : "Confirm Approval"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <PortalDialog
          onClose={() => setRejectingItem(null)}
          eyebrow={<span className="text-[var(--badge-red-text)]">Decision</span>}
          title="Reject NOC Request"
          className="sm:max-w-[520px]"
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => { e.preventDefault(); handleReject(new FormData(e.currentTarget)); }}
          >
            <input type="hidden" name="nocId" value={rejectingItem.id} />

            <p className="text-muted-foreground text-xs">
              State the reason for rejecting the NOC request for <strong>{rejectingItem.studentName || rejectingItem.rollNumber}</strong>. The student will receive this in their notification.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="noc-reject-reason">Rejection reason (required)</Label>
              <Textarea
                id="noc-reject-reason"
                name="adminRemarks"
                required
                minLength={2}
                rows={4}
                placeholder="e.g. Schedule conflicts with core curriculum; unaccredited off-campus entity; active placement ban..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectingItem(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                <XCircle />
                {isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* Direct Upload Document Modal */}
      {uploadingItem && (
        <PortalDialog
          onClose={() => setUploadingItem(null)}
          eyebrow="Certificate"
          title="Upload Signed NOC PDF"
          className="sm:max-w-[480px]"
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => { e.preventDefault(); handleUploadDoc(new FormData(e.currentTarget)); }}
          >
            <input type="hidden" name="nocId" value={uploadingItem.id} />

            <p className="text-muted-foreground text-xs">
              Upload signed certificate PDF for <strong>{uploadingItem.studentName || uploadingItem.rollNumber}</strong> ({uploadingItem.company}).
            </p>

            <div className="grid gap-2">
              <Label htmlFor="noc-signed-pdf">Signed PDF file (max 10MB)</Label>
              <Input
                id="noc-signed-pdf"
                type="file"
                name="file"
                required
                accept="application/pdf"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadingItem(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                <Upload />
                {isPending ? "Uploading..." : "Upload Certificate"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* PDF Document Preview Modal */}
      {previewDoc && (
        // The `.modal.doc-preview-modal` rules were scoped to the hand-rolled
        // `.modal` wrapper, so the frame's height has to be stated here.
        <PortalDialog
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          className="flex h-[88vh] flex-col sm:max-w-[min(1100px,96vw)]"
        >
          <div className="bg-muted min-h-0 flex-1 overflow-hidden rounded-[10px] border">
            <iframe src={previewDoc.url} title={previewDoc.title} className="h-full w-full border-0" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewDoc(null)}>
              Close preview
            </Button>
            <Button asChild>
              <a
                href={previewDoc.url}
                download="noc-certificate.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download /> Download
              </a>
            </Button>
          </DialogFooter>
        </PortalDialog>
      )}
    </div>
  );
}
