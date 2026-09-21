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
  MapPin,
  Plus,
  ShieldAlert,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { cancelNocRequestAction, submitNocRequest, uploadNocOffCampusProofAction } from "@/app/forms/actions";
import { PortalDialog } from "@/components/common/portal-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const downloads = [
  {
    name: "Placement Policy 2026–27",
    size: "Official PDF",
    url: "/documents/placement-policy-2026-27.pdf",
    filename: "placement-policy-2026-27.pdf",
  },
  {
    name: "Student Resume Template",
    size: "Template Guide PDF",
    url: "/documents/student-resume-template.pdf",
    filename: "student-resume-template.pdf",
  },
  {
    name: "Internship Undertaking Form",
    size: "Official Form PDF",
    url: "/documents/internship-undertaking-form.pdf",
    filename: "internship-undertaking-form.pdf",
  },
];

/**
 * Sizing shared by the three NOC row actions. Their colours are marked
 * important at each call site because `.simple-table button` in globals.css is
 * unlayered, so it outranks every utility class regardless of specificity.
 */
const ROW_ACTION = "h-auto px-2 py-1 text-[11px]";

/** One labelled panel in the NOC detail dialog. */
function DetailBox({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-muted gap-1 rounded-[10px] px-3.5 py-3 shadow-none">
      <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold uppercase">
        {label}
      </span>
      {children}
    </Card>
  );
}

export type LocalNoc = {
  id: string;
  company: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  /** The student's own remarks, as submitted. */
  message?: string | null;
  /** The placement cell's remarks on the decision. Read-only here. */
  adminRemarks?: string | null;
  documentUrl?: string | null;
  /** Whether the offer behind the request is on- or off-campus. */
  source?: "ON_CAMPUS" | "OFF_CAMPUS" | string;
  /** The student's own proof of an off-campus offer, uploaded at submission. */
  offCampusProofUrl?: string | null;
  /** False means this row is only a record of dates/company — no decision was made. */
  nocRequired?: boolean;
  createdAt?: string;
};

export function FormsView({ initialNocs = [] }: { initialNocs?: LocalNoc[] }) {
  const [tab, setTab] = useState("guidelines");
  const [modal, setModal] = useState(false);
  const [viewingNoc, setViewingNoc] = useState<LocalNoc | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<{ url: string; title: string } | null>(null);
  const [cancellingNoc, setCancellingNoc] = useState<LocalNoc | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // New-request form: the offer source, the resulting proof-upload flow, and
  // the "no decision needed" checkbox all need to react to each other before
  // the surrounding <form> is ever submitted, so they live in state rather
  // than being read from FormData at submit time like the plain text fields.
  const [nocSource, setNocSource] = useState<"ON_CAMPUS" | "OFF_CAMPUS" | "">("");
  const [nocRequired, setNocRequired] = useState(true);
  const [offCampusProof, setOffCampusProof] = useState<{ url: string; fileName: string } | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  function resetNocFormState() {
    setNocSource("");
    setNocRequired(true);
    setOffCampusProof(null);
    setProofUploading(false);
    setProofError(null);
  }

  function handleProofFileChange(file: File | null) {
    if (!file) return;
    setProofError(null);
    setOffCampusProof(null);
    setProofUploading(true);
    startTransition(async () => {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const res = await uploadNocOffCampusProofAction(uploadData);
      setProofUploading(false);
      if (res.error || !res.url) {
        setProofError(res.error ?? "Failed to upload document.");
        return;
      }
      setOffCampusProof({ url: res.url, fileName: res.fileName ?? file.name });
    });
  }

  function handleAction(formData: FormData) {
    setFormError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const result = await submitNocRequest(formData);
      if (!result?.error) {
        setModal(false);
        setFormError(null);
        resetNocFormState();
        setActionSuccess("NOC request submitted successfully.");
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleCancelSubmit(formData: FormData) {
    setFormError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const result = await cancelNocRequestAction(formData);
      if (!result?.error) {
        setCancellingNoc(null);
        setActionSuccess("NOC request cancelled successfully.");
      } else {
        setFormError(result.error);
      }
    });
  }

  function openModal() {
    setFormError(null);
    setActionSuccess(null);
    resetNocFormState();
    setModal(true);
  }

  function closeModal() {
    setFormError(null);
    setModal(false);
  }

  // The new-request dialog and the cancel confirmation share `formError`, so
  // opening one has to clear what the other left behind.
  function openCancel(noc: LocalNoc) {
    setFormError(null);
    setCancellingNoc(noc);
  }

  return (
    <div className="module-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Resources</span>
          <h1>Forms & documents</h1>
          <p>Placement guidelines, NOC requests, and official downloads.</p>
        </div>
      </section>

      {actionSuccess && (
        <Alert variant="success" className="mt-3.5 mb-4">
          <CheckCircle2 />
          <AlertDescription>{actionSuccess}</AlertDescription>
        </Alert>
      )}

      <div className="tabs">
        {[
          ["guidelines", "T&P guidelines"],
          ["noc", `NOC requests (${initialNocs.length})`],
          ["downloads", "Downloads"],
        ].map(([id, label]) => (
          <Button
            type="button"
            variant="ghost"
            className={`h-auto ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "guidelines" && (
        <section className="guidelines">
          <div className="notice">
            <ShieldAlert />
            <div>
              <strong>Read before applying</strong>
              <p>Participation in placement activities indicates acceptance of the institute placement policy.</p>
            </div>
          </div>
          <h2>Student placement guidelines</h2>
          <ol>
            <li>Keep your academic and contact information accurate at all times.</li>
            <li>Apply only after reviewing the complete role description and eligibility criteria.</li>
            <li>Attendance in registered tests and interviews is mandatory unless formally excused.</li>
            <li>Misrepresentation of academic or personal information may result in a placement ban.</li>
            <li>Communicate with recruiters only through the designated placement coordinators.</li>
            <li>Report off-campus offers to the Training & Placement Cell promptly.</li>
          </ol>
        </section>
      )}

      {tab === "noc" && (
        <section className="noc-section">
          <div className="notice warning">
            <ShieldAlert />
            <div>
              <strong>Important academic notice</strong>
              <p>
                An NOC grants permission for training but does not waive attendance, credits, examinations, or other academic requirements.
              </p>
            </div>
          </div>

          <div className="section-action">
            <div>
              <h2>Your NOC requests</h2>
            </div>
            <Button type="button" className="h-auto" onClick={openModal}>
              <Plus />
              Request NOC
            </Button>
          </div>

          {initialNocs.length ? (
            <div className="simple-table mt-3.5">
              <div>
                <b>Company & location</b>
                <b>Training period</b>
                <b>Status</b>
                <b>Actions</b>
              </div>
              {initialNocs.map((noc) => {
                const isNotRequired = noc.nocRequired === false;
                const isPendingReview = noc.status === "PENDING";
                // A not-required row is stored as APPROVED (nothing was left
                // to decide), so its badge is derived from the flag, not the
                // status, to avoid implying a real decision was made.
                const isApproved = noc.status === "APPROVED" && !isNotRequired;
                const isRejected = noc.status === "REJECTED";

                return (
                  // `.simple-table > div` is unlayered and states its own
                  // column track, so the row's wider one has to be important.
                  <div key={noc.id} className="grid-cols-[1.4fr_1.1fr_0.8fr_1.1fr]!">
                    <div>
                      <strong className="text-foreground block">{noc.company}</strong>
                      <small className="text-muted-foreground text-[10px]">
                        {[noc.city, noc.state].filter(Boolean).join(", ") || "Location specified in request"}
                      </small>
                    </div>

                    <div>
                      <span className="block font-semibold">
                        {new Date(noc.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} –{" "}
                        {new Date(noc.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>

                    <div>
                      {isNotRequired && (
                        <Badge className="gap-1 bg-[var(--surface-alt)] text-[9px] font-extrabold text-[var(--muted-foreground)]">
                          <FileBadge /> Not required
                        </Badge>
                      )}
                      {isPendingReview && (
                        <Badge className="gap-1 bg-[var(--badge-orange-bg)] text-[9px] font-extrabold text-[var(--badge-orange-text)]">
                          <Clock3 /> Pending
                        </Badge>
                      )}
                      {isApproved && (
                        <Badge className="gap-1 bg-[var(--badge-green-bg)] text-[9px] font-extrabold text-[var(--badge-green-text)]">
                          <CheckCircle2 /> Approved
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge className="gap-1 bg-[var(--badge-red-bg)] text-[9px] font-extrabold text-[var(--badge-red-text)]">
                          <XCircle /> Rejected
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setViewingNoc(noc)}
                        title="View request details"
                        className={`${ROW_ACTION} bg-[var(--surface-alt)]! text-[var(--blue)]!`}
                      >
                        <Eye />
                        Details
                      </Button>

                      {isApproved && noc.documentUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setPreviewDocUrl({ url: `/api/noc-documents/${noc.id}`, title: `NOC - ${noc.company}` })}
                          title="View certificate"
                          className={`${ROW_ACTION} bg-[var(--badge-green-bg)]! text-[var(--green)]!`}
                        >
                          <FileCheck2 />
                          Certificate
                        </Button>
                      )}

                      {isPendingReview && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => openCancel(noc)}
                          title="Cancel request"
                          className={`${ROW_ACTION} bg-[var(--badge-red-bg)]! text-[var(--badge-red-text)]!`}
                        >
                          <Trash2 />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <FileBadge />
              <h3>No NOC requests</h3>
              <p>You have not made any NOC requests.</p>
            </div>
          )}
        </section>
      )}

      {tab === "downloads" && (
        <section className="downloads">
          <h2>Official documents</h2>
          {downloads.map((file) => (
            <article key={file.name}>
              <FileText />
              <div>
                <strong>{file.name}</strong>
                <span>PDF · {file.size}</span>
              </div>
              <a
                href={file.url}
                download={file.filename}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download />
                Download
              </a>
            </article>
          ))}
        </section>
      )}

      {/* New NOC Modal */}
      {modal && (
        <PortalDialog
          onClose={closeModal}
          eyebrow="New request"
          title="Request an NOC"
          className="max-h-[88vh] overflow-y-auto sm:max-w-[650px]"
        >
          <form className="grid gap-4" action={handleAction}>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="noc-company">
                  Company name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="noc-company"
                  name="company"
                  required
                  minLength={2}
                  placeholder="e.g. Google India"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="noc-city">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="noc-city"
                  name="city"
                  required
                  minLength={2}
                  placeholder="e.g. Bengaluru"
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="noc-address">
                  Company address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="noc-address"
                  name="address"
                  required
                  minLength={2}
                  placeholder="Complete office / facility address"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="noc-start-date">
                  Start date <span className="text-destructive">*</span>
                </Label>
                <Input id="noc-start-date" name="startDate" required type="date" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="noc-end-date">
                  End date <span className="text-destructive">*</span>
                </Label>
                <Input id="noc-end-date" name="endDate" required type="date" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="noc-state">
                  State <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="noc-state"
                  name="state"
                  required
                  minLength={2}
                  placeholder="e.g. Karnataka"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="noc-pincode">
                  Pincode <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="noc-pincode"
                  name="pincode"
                  required
                  pattern="[0-9]{6}"
                  title="6-digit pincode"
                  placeholder="6-digit postal code"
                />
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label>
                  Offer source <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={nocSource === "ON_CAMPUS" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => {
                      setNocSource("ON_CAMPUS");
                      setOffCampusProof(null);
                      setProofError(null);
                    }}
                  >
                    On-campus
                  </Button>
                  <Button
                    type="button"
                    variant={nocSource === "OFF_CAMPUS" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setNocSource("OFF_CAMPUS")}
                  >
                    Off-campus
                  </Button>
                </div>
                <input type="hidden" name="source" value={nocSource} />
              </div>

              {nocSource === "OFF_CAMPUS" && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="noc-offcampus-proof">
                    Proof of offer (offer letter) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="noc-offcampus-proof"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    disabled={proofUploading}
                    onChange={(e) => handleProofFileChange(e.target.files?.[0] ?? null)}
                  />
                  <input type="hidden" name="offCampusProofUrl" value={offCampusProof?.url ?? ""} />
                  <p className="text-muted-foreground text-[11px]">
                    So the placement cell can confirm this is a real offer before proceeding. PDF, image, or Word file, up to 10MB.
                  </p>
                  {proofUploading && (
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                      <UploadCloud size={12} /> Uploading...
                    </span>
                  )}
                  {offCampusProof && (
                    <span className="flex items-center gap-1.5 text-[11px] text-[var(--green)]">
                      <CheckCircle2 size={12} /> Uploaded: {offCampusProof.fileName}
                    </span>
                  )}
                  {proofError && (
                    <span className="text-destructive text-[11px]">{proofError}</span>
                  )}
                </div>
              )}

              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="noc-message">Remarks / Purpose (optional)</Label>
                <Textarea
                  id="noc-message"
                  name="message"
                  rows={3}
                  placeholder="Provide context on the training offer, department, or special schedule requirements..."
                />
              </div>

              <div className="flex items-start gap-2 sm:col-span-2">
                <Checkbox
                  id="noc-not-required"
                  checked={!nocRequired}
                  onCheckedChange={(checked) => setNocRequired(!checked)}
                />
                <div className="grid gap-0.5">
                  <Label htmlFor="noc-not-required" className="font-normal">
                    An NOC is not required for this internship
                  </Label>
                  <input type="hidden" name="nocRequired" value={String(nocRequired)} />
                  <p className="text-muted-foreground text-[11px]">
                    Use this only to record the company and dates on file. No certificate is
                    issued and there is nothing for the placement cell to approve or reject.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending ||
                  proofUploading ||
                  !nocSource ||
                  (nocSource === "OFF_CAMPUS" && !offCampusProof)
                }
              >
                <FileBadge />
                {isPending ? "Submitting..." : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* View NOC Details Modal */}
      {viewingNoc && (
        <PortalDialog
          onClose={() => setViewingNoc(null)}
          eyebrow="NOC Details"
          title={viewingNoc.company}
          className="max-h-[88vh] overflow-y-auto sm:max-w-[600px]"
        >
          <div className="grid gap-3.5 text-xs">
            <Card className="bg-muted flex-row items-center justify-between rounded-[10px] px-3.5 py-3 shadow-none">
              <span className="text-muted-foreground font-semibold">Status</span>
              <Badge variant="outline" className="font-extrabold">
                {viewingNoc.nocRequired === false ? "Not required" : viewingNoc.status}
              </Badge>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailBox
                label={
                  <>
                    <Calendar size={12} /> Start date
                  </>
                }
              >
                <strong className="block">
                  {new Date(viewingNoc.startDate).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
                </strong>
              </DetailBox>

              <DetailBox
                label={
                  <>
                    <Calendar size={12} /> End date
                  </>
                }
              >
                <strong className="block">
                  {new Date(viewingNoc.endDate).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
                </strong>
              </DetailBox>
            </div>

            <DetailBox label="Offer source">
              <strong className="block">
                {viewingNoc.source === "OFF_CAMPUS" ? "Off-campus" : "On-campus"}
              </strong>
            </DetailBox>

            <DetailBox
              label={
                <>
                  <MapPin size={12} /> Company Address
                </>
              }
            >
              <p className="leading-relaxed">
                {viewingNoc.address || "Address not provided"}<br />
                {[viewingNoc.city, viewingNoc.state, viewingNoc.pincode].filter(Boolean).join(", ")}
              </p>
            </DetailBox>

            {viewingNoc.message && (
              <DetailBox label="Student remarks / notes">
                <p className="leading-relaxed italic">
                  &ldquo;{viewingNoc.message}&rdquo;
                </p>
              </DetailBox>
            )}

            {viewingNoc.adminRemarks && (
              <DetailBox
                label={viewingNoc.status === "REJECTED" ? "Reason for rejection" : "Placement cell remarks"}
              >
                <p className="leading-relaxed">{viewingNoc.adminRemarks}</p>
              </DetailBox>
            )}

            {viewingNoc.offCampusProofUrl && (
              <Card className="flex-row items-center justify-between gap-3 rounded-[10px] border-[var(--blue)] bg-[var(--badge-blue-bg)] px-3.5 py-3 shadow-none">
                <div>
                  <strong className="block text-xs text-[var(--badge-blue-text)]">Your offer proof is on file</strong>
                  <small className="text-muted-foreground text-[10px]">Submitted with this request</small>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setPreviewDocUrl({ url: `/api/noc-offcampus-proof/${viewingNoc.id}`, title: `Offer proof - ${viewingNoc.company}` });
                  }}
                >
                  <Eye /> View Document
                </Button>
              </Card>
            )}

            {viewingNoc.documentUrl && (
              <Card className="flex-row items-center justify-between gap-3 rounded-[10px] border-[var(--green)] bg-[var(--badge-green-bg)] px-3.5 py-3 shadow-none">
                <div>
                  <strong className="block text-xs text-[var(--badge-green-text)]">Signed NOC Certificate Available</strong>
                  <small className="text-muted-foreground text-[10px]">Approved by Placement Cell</small>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--green)] hover:bg-[var(--green)]/90"
                  onClick={() => {
                    setPreviewDocUrl({ url: `/api/noc-documents/${viewingNoc.id}`, title: `NOC - ${viewingNoc.company}` });
                  }}
                >
                  <Eye /> View Certificate
                </Button>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewingNoc(null)}>
              Close
            </Button>
          </DialogFooter>
        </PortalDialog>
      )}

      {/* Cancel Request Dialog */}
      {cancellingNoc && (
        <PortalDialog
          onClose={() => setCancellingNoc(null)}
          eyebrow={<span className="text-destructive">Cancel request</span>}
          title="Cancel NOC Request?"
          className="sm:max-w-[460px]"
        >
          <form className="grid gap-3" action={handleCancelSubmit}>
            <input type="hidden" name="nocId" value={cancellingNoc.id} />

            <p className="text-muted-foreground text-xs leading-relaxed">
              Are you sure you want to cancel your NOC request for <strong>{cancellingNoc.company}</strong>? This action cannot be undone.
            </p>

            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCancellingNoc(null)}>
                Keep request
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                <Trash2 />
                {isPending ? "Cancelling..." : "Yes, cancel request"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* PDF Document Preview Modal */}
      {previewDocUrl && (
        // The `.modal.doc-preview-modal` rules were scoped to the hand-rolled
        // `.modal` wrapper, so the frame's height has to be stated here.
        <PortalDialog
          onClose={() => setPreviewDocUrl(null)}
          title={previewDocUrl.title}
          className="flex h-[88vh] flex-col sm:max-w-[min(1100px,96vw)]"
        >
          <div className="bg-muted min-h-0 flex-1 overflow-hidden rounded-[10px] border">
            <iframe
              src={previewDocUrl.url}
              title={previewDocUrl.title}
              className="h-full w-full border-0"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewDocUrl(null)}>
              Close preview
            </Button>
            <Button asChild>
              <a
                href={previewDocUrl.url}
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
