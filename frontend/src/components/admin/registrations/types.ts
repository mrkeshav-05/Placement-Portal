import type { ApplicationStatus } from "@prisma/client";

/** One student's application to one company event, joined to what the office needs to see. */
export type AdminApplicationRow = {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  rollNumber: string | null;
  branch: string | null;
  batch: number | null;
  degree: string | null;
  cgpa: number | null;
  class10Percent: number | null;
  class12Percent: number | null;
  personalEmail: string | null;
  contactNumber: string | null;
  jobProfileId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  resumeId: string | null;
  resumeUrl: string | null;
  resumeLabel: string | null;
  status: ApplicationStatus;
  /** The linked placement record, if the office has already recorded one. */
  offerId: string | null;
  /** Display string, e.g. "16 Nov 2026". */
  appliedAt: string;
  /** ISO timestamp, for sorting. */
  appliedAtIso: string;
  updatedAt: string;
};

export type JobOption = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  batch: number;
};
