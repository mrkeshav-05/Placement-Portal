import type { ApplicationStatus } from "@prisma/client";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";

const CLASS_BY_STATUS: Record<ApplicationStatus, string> = {
  APPLIED: "cell-status development",
  SHORTLISTED: "cell-status",
  INTERVIEW: "cell-status draft",
  SELECTED: "cell-status",
  OFFER_ACCEPTED: "cell-status",
  REJECTED: "cell-status pending",
  OFFER_DECLINED: "cell-status pending",
  WITHDRAWN: "cell-status pending",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <b className={CLASS_BY_STATUS[status]}>{APPLICATION_STATUS_LABELS[status]}</b>;
}
