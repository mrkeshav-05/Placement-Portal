import type { ExportColumnDef } from "@/components/admin/export-columns-dialog";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import type { AdminApplicationRow } from "./types";

/** Every column either tab can export; each tab chooses which start ticked. */
export const EXPORT_COLUMNS: ExportColumnDef<AdminApplicationRow>[] = [
  { id: "sno", label: "S.No", group: "Basic", locked: true, value: (_row, index) => index + 1 },
  { id: "rollNumber", label: "Roll Number", group: "Basic", locked: true, value: (row) => row.rollNumber ?? "" },
  { id: "name", label: "Name", group: "Basic", locked: true, value: (row) => row.studentName },
  { id: "instituteEmail", label: "Institute Mail ID", group: "Basic", locked: true, value: (row) => row.studentEmail },
  { id: "contact", label: "Contact", group: "Basic", value: (row) => row.contactNumber ?? "" },
  { id: "personalEmail", label: "Personal Mail ID", group: "Basic", value: (row) => row.personalEmail ?? "" },
  { id: "resumeUrl", label: "Resume URL", group: "Basic", value: (row) => row.resumeUrl ?? "" },
  { id: "batch", label: "Batch", group: "Academic", value: (row) => row.batch ?? "" },
  { id: "degree", label: "Degree", group: "Academic", value: (row) => row.degree ?? "" },
  { id: "branch", label: "Branch", group: "Academic", value: (row) => row.branch ?? "" },
  { id: "cgpa", label: "CGPA", group: "Academic", value: (row) => row.cgpa ?? "" },
  { id: "cgpa12", label: "12th %", group: "Academic", value: (row) => row.class12Percent ?? "" },
  { id: "cgpa10", label: "10th %", group: "Academic", value: (row) => row.class10Percent ?? "" },
  { id: "companyName", label: "Company", group: "Application", value: (row) => row.companyName },
  { id: "jobTitle", label: "Role", group: "Application", value: (row) => row.jobTitle },
  { id: "status", label: "Status", group: "Application", value: (row) => APPLICATION_STATUS_LABELS[row.status] },
  { id: "appliedAt", label: "Applied", group: "Application", value: (row) => row.appliedAt },
];

/** Registrations: the contact sheet a recruiter asks for. */
export const REGISTRATION_DEFAULTS = new Set([
  "sno", "rollNumber", "name", "instituteEmail",
  "contact", "personalEmail", "batch", "degree", "branch", "cgpa", "cgpa12", "cgpa10",
]);

/** Manage: the pipeline view, with the event and stage. */
export const PIPELINE_DEFAULTS = new Set([
  "sno", "rollNumber", "name", "instituteEmail",
  "branch", "batch", "cgpa", "companyName", "jobTitle", "status", "appliedAt",
]);
