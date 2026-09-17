import type { ApplicationStatus } from "@prisma/client";

/** Pipeline order: this is also the order stage dropdowns and filters list them in. */
export const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "WITHDRAWN",
] as const satisfies readonly ApplicationStatus[];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Assessment / Interview",
  SELECTED: "Selected",
  REJECTED: "Not Selected",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_DECLINED: "Offer Declined",
  WITHDRAWN: "Withdrawn",
};

/**
 * Whether the candidate confirmed or declined an offer is placement-cell
 * bookkeeping, not something a student needs surfaced back at them — they
 * already know what they told the office. The backend masks these to
 * SELECTED before a student's own application list ever leaves the server
 * (see `student_facing_status` in `applications.py`); this list exists so no
 * student-facing component accidentally offers them as a filter/display value.
 */
export const ADMIN_ONLY_STATUSES: readonly ApplicationStatus[] = ["OFFER_ACCEPTED", "OFFER_DECLINED"];

export const STUDENT_VISIBLE_STATUSES = APPLICATION_STATUSES.filter(
  (status) => !ADMIN_ONLY_STATUSES.includes(status),
);

/** A status reaching a hired candidate's own Offer record, once one exists. */
export function isHiredStatus(status: ApplicationStatus): boolean {
  return status === "SELECTED" || status === "OFFER_ACCEPTED";
}

/**
 * Mirrors the backend's `student_facing_status` (applications.py) for the
 * Prisma fallback path, which reads the database directly and would
 * otherwise bypass that masking entirely.
 */
export function studentFacingStatus(status: ApplicationStatus): ApplicationStatus {
  return ADMIN_ONLY_STATUSES.includes(status) ? "SELECTED" : status;
}
