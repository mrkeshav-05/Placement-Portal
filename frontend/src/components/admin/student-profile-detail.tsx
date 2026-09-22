import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileBadge,
  FileCheck2,
  FileText,
  GraduationCap,
  IdCard,
  Mail,
  UserRound,
  XCircle,
} from "lucide-react";
import { StudentAcademicCorrectionDialog } from "@/components/admin/student-academic-correction-dialog";
import {
  formatRupees,
  formatStipend,
  isCtcType,
  OFFER_STATUS_LABELS,
  OFFER_TYPE_LABELS,
  type OfferStatus,
  type OfferType,
} from "@/lib/offer-schema";

export type AdminStudentDetail = {
  id: string;
  name: string;
  email: string;
  rollNumber: string | null;
  personalEmail: string | null;
  contactNumber: string | null;
  altContactNumber: string | null;
  branch: string | null;
  batch: number | null;
  degree: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  currentAddress: string | null;
  class10Percent: number | null;
  class12Percent: number | null;
  cgpa: number | null;
  backlogs: number;
  bans: number;
  profileCompletion: number;
  aadhaarProvided: boolean;
  panProvided: boolean;
  resumes: Array<{ id: string; label: string; fileName: string; uploadedAt: string }>;
  applications: Array<{ id: string; company: string; role: string; status: string; appliedAt: string }>;
  offers: Array<{
    id: string;
    company: string;
    // jobProfile is optional on Offer (off-campus/manual entries)
    jobTitle: string | null;
    type: OfferType;
    status: OfferStatus;
    ctc: number | null;
    stipend: number | null;
    offeredAt: string;
  }>;
  nocRequests: Array<{
    id: string;
    company: string;
    source: "ON_CAMPUS" | "OFF_CAMPUS" | string;
    status: "PENDING" | "APPROVED" | "REJECTED" | string;
    /** False means this row only records dates/company; no decision was made — see displayNocStatus below. */
    nocRequired: boolean;
    startDate: string;
    endDate: string;
  }>;
};

/**
 * The status a NOC row displays as, distinct from its stored `status`: a
 * not-required row is stored APPROVED (nothing was left to decide) but must
 * never read as a real approval. Mirrors `displayStatus` in
 * `noc-requests-manager.tsx`, re-declared here rather than imported since
 * that function isn't exported and the two components are otherwise
 * unrelated.
 */
function displayNocStatus(
  noc: AdminStudentDetail["nocRequests"][number],
): "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" {
  if (noc.nocRequired === false) return "NOT_REQUIRED";
  if (noc.status === "PENDING" || noc.status === "APPROVED" || noc.status === "REJECTED") {
    return noc.status;
  }
  return "PENDING";
}

function value(value: string | number | null) {
  return value === null || value === "" ? "Not provided" : String(value);
}

export function StudentProfileDetail({
  student,
  canUpdateAcademic = false,
}: {
  student: AdminStudentDetail;
  /** Gated by `students.update` — see docs/DECISIONS.md (2026-09-22). */
  canUpdateAcademic?: boolean;
}) {
  return (
    <div className="admin-page">
      <Link className="back-link" href="/admin/students">
        <ArrowLeft />
        Back to students
      </Link>

      <section className="admin-profile-banner">
        <div>
          <span className="eyebrow">Student record</span>
          <h1>{student.name}</h1>
          <p>{student.email}</p>
        </div>
        <strong>{student.profileCompletion}% profile complete</strong>
      </section>

      <section className="admin-profile-grid">
        <article>
          <header>
            <UserRound />
            <div>
              <h2>Personal details</h2>
              <p>Identity and academic directory fields</p>
            </div>
          </header>
          <dl>
            <div>
              <dt>Roll number</dt>
              <dd>{student.rollNumber ? <span className="identifier">{student.rollNumber}</span> : value(null)}</dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{value(student.gender)}</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{value(student.dateOfBirth)}</dd>
            </div>
            <div>
              <dt>Blood group</dt>
              <dd>{value(student.bloodGroup)}</dd>
            </div>
            <div>
              <dt>Current address</dt>
              <dd>{value(student.currentAddress)}</dd>
            </div>
          </dl>
        </article>

        <article>
          <header>
            <GraduationCap />
            <div>
              <h2>Academic details</h2>
              <p>Current saved eligibility inputs</p>
            </div>
            {canUpdateAcademic ? (
              <div className="ml-auto">
                <StudentAcademicCorrectionDialog
                  studentId={student.id}
                  currentCgpa={student.cgpa}
                  currentBacklogs={student.backlogs}
                />
              </div>
            ) : null}
          </header>
          <dl>
            <div>
              <dt>Branch</dt>
              <dd>{value(student.branch)}</dd>
            </div>
            <div>
              <dt>Degree</dt>
              <dd>{value(student.degree)}</dd>
            </div>
            <div>
              <dt>Batch</dt>
              <dd>{value(student.batch)}</dd>
            </div>
            <div>
              <dt>Class 10</dt>
              <dd>{student.class10Percent === null ? "Not provided" : `${student.class10Percent}%`}</dd>
            </div>
            <div>
              <dt>Class 12</dt>
              <dd>{student.class12Percent === null ? "Not provided" : `${student.class12Percent}%`}</dd>
            </div>
            <div>
              <dt>CGPA</dt>
              <dd>{value(student.cgpa)}</dd>
            </div>
            <div>
              <dt>Backlogs</dt>
              <dd>{student.backlogs}</dd>
            </div>
            <div>
              <dt>Placement bans</dt>
              <dd>{student.bans}</dd>
            </div>
          </dl>
        </article>

        <article>
          <header>
            <Mail />
            <div>
              <h2>Contact details</h2>
              <p>Saved communication information</p>
            </div>
          </header>
          <dl>
            <div>
              <dt>Institute email</dt>
              <dd>{student.email}</dd>
            </div>
            <div>
              <dt>Personal email</dt>
              <dd>{value(student.personalEmail)}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{value(student.contactNumber)}</dd>
            </div>
            <div>
              <dt>Alternate phone</dt>
              <dd>{value(student.altContactNumber)}</dd>
            </div>
          </dl>
        </article>

        <article>
          <header>
            <IdCard />
            <div>
              <h2>Documents</h2>
              <p>Presence only; sensitive values are never displayed</p>
            </div>
          </header>
          <dl>
            <div>
              <dt>Aadhaar</dt>
              <dd>{student.aadhaarProvided ? "Provided" : "Not provided"}</dd>
            </div>
            <div>
              <dt>PAN</dt>
              <dd>{student.panProvided ? "Provided" : "Not provided"}</dd>
            </div>
            <div>
              <dt>Resumes</dt>
              <dd>{student.resumes.length}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="admin-detail-section">
        <header>
          <FileText />
          <div>
            <h2>Resumes</h2>
            <p>Uploaded file metadata</p>
          </div>
        </header>
        {student.resumes.length ? (
          student.resumes.map((resume) => (
            <div className="admin-detail-row" key={resume.id}>
              <span>
                <strong>{resume.label}</strong>
                <small>{resume.fileName}</small>
              </span>
              <span>{resume.uploadedAt}</span>
            </div>
          ))
        ) : (
          <div className="admin-empty compact">
            <FileText />
            <h2>No resumes</h2>
            <p>This student has not uploaded a resume.</p>
          </div>
        )}
      </section>

      <section className="admin-detail-section">
        <header>
          <BriefcaseBusiness />
          <div>
            <h2>Applications</h2>
            <p>Roles submitted by this student</p>
          </div>
        </header>
        {student.applications.length ? (
          student.applications.map((application) => (
            <div className="admin-detail-row" key={application.id}>
              <span>
                <strong>
                  {application.company} · {application.role}
                </strong>
                <small>{application.appliedAt}</small>
              </span>
              <b className="cell-status">{application.status}</b>
            </div>
          ))
        ) : (
          <div className="admin-empty compact">
            <BriefcaseBusiness />
            <h2>No applications</h2>
            <p>This student has not applied to a role.</p>
          </div>
        )}
      </section>

      <section className="admin-detail-section">
        <header>
          <Award />
          <div>
            <h2>Placement records</h2>
            <p>Every recorded offer, of any status</p>
          </div>
        </header>
        {student.offers.length ? (
          student.offers.map((offer) => (
            <div className="admin-detail-row" key={offer.id}>
              <span>
                <strong>
                  {offer.company} · {offer.jobTitle ?? OFFER_TYPE_LABELS[offer.type]}
                </strong>
                <small>
                  {OFFER_TYPE_LABELS[offer.type]} · {offer.offeredAt}
                </small>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <strong>
                  {isCtcType(offer.type) ? formatRupees(offer.ctc) : formatStipend(offer.stipend)}
                </strong>
                <b className={`cell-status ${offer.status.toLowerCase()}`}>
                  {OFFER_STATUS_LABELS[offer.status]}
                </b>
              </span>
            </div>
          ))
        ) : (
          <div className="admin-empty compact">
            <Award />
            <h2>No offers</h2>
            <p>This student has no recorded placement offers.</p>
          </div>
        )}
      </section>

      <section className="admin-detail-section">
        <header>
          <FileCheck2 />
          <div>
            <h2>NOC requests</h2>
            <p>Full history, not only the latest</p>
          </div>
        </header>
        {student.nocRequests.length ? (
          student.nocRequests.map((noc) => {
            const state = displayNocStatus(noc);
            return (
              <div className="admin-detail-row" key={noc.id}>
                <span>
                  <strong>{noc.company}</strong>
                  <small>
                    {noc.source === "OFF_CAMPUS" ? "Off-campus" : "On-campus"} · {noc.startDate} – {noc.endDate}
                  </small>
                </span>
                {state === "NOT_REQUIRED" && (
                  <span
                    className="cell-status"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "var(--surface-alt)",
                      color: "var(--muted-foreground)",
                    }}
                  >
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
              </div>
            );
          })
        ) : (
          <div className="admin-empty compact">
            <FileCheck2 />
            <h2>No NOC requests</h2>
            <p>This student has not requested an NOC.</p>
          </div>
        )}
      </section>
    </div>
  );
}
