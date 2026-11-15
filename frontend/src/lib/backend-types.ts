/**
 * Response shapes returned by the FastAPI service. These mirror the Pydantic
 * models in backend/app/schemas and keep the client calls typed while data
 * access is being moved out of the frontend.
 */

export type BackendProfile = {
  id: string;
  email: string | null;
  name: string | null;
  rollNumber: string | null;
  personalEmail: string | null;
  contactNumber: string | null;
  altContactNumber: string | null;
  branch: string | null;
  degree: string | null;
  batch: number | null;
  gender: string | null;
  bloodGroup: string | null;
  /** ISO-8601 timestamp. */
  dateOfBirth: string | null;
  currentAddress: string | null;
  class10Percent: number | null;
  class12Percent: number | null;
  cgpa: number | null;
  backlogs: number | null;
  aadhaarEncrypted?: string | null;
  aadhaarProvided?: boolean;
  aadhaarMasked?: string | null;
  aadhaarDocProvided?: boolean;
  aadhaarDocFileName?: string | null;
  panCardEncrypted?: string | null;
  panProvided?: boolean;
  panMasked?: string | null;
  panDocProvided?: boolean;
  panDocFileName?: string | null;
  collegeIdEncrypted?: string | null;
  collegeIdProvided?: boolean;
  collegeIdMasked?: string | null;
  collegeIdDocProvided?: boolean;
  collegeIdDocFileName?: string | null;
};

export type BackendResume = {
  id: string;
  label: string;
  fileUrl: string;
  fileName: string;
  /** ISO-8601 timestamp. */
  uploadedAt: string;
};

export type BackendFeedback = {
  id: string;
  feedbackType: string;
  content: string;
  resolved: boolean;
  adminResponse: string | null;
  createdAt: string;
};

export type BackendJobCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  /** "Dream" / "First Round"; absent from entries cached before it was sent. */
  category?: string | null;
};

/**
 * A drive as `GET /api/v1/jobs` returns it: ACTIVE and ENDED, soonest
 * deadline first, never a draft. Served from the Redis cache, so treat it as
 * up to `CACHE_TTL_SECONDS` old when nothing has written to it.
 */
export type BackendJob = {
  id: string;
  companyId: string;
  company: BackendJobCompany | null;
  title: string;
  /** Mirrors the Prisma `JobType` enum, which the API sends by name. */
  type: "INTERNSHIP" | "FTE" | "INTERNSHIP_PPO" | "INTERNSHIP_FTE";
  /** `DRAFT` never reaches a student, but the vocabulary is the full enum. */
  status: "ACTIVE" | "ENDED" | "DRAFT";
  locations: string[];
  ctcStipend: number | null;
  ctcStipendInfo: string | null;
  minCGPA: number;
  /** Unset means no threshold, the same convention `minCGPA`'s own default carries. */
  min10Percent: number | null;
  min12Percent: number | null;
  maxBacklogs: number;
  maxBans: number;
  allowedBranches: string[];
  allowedDegrees: string[];
  allowedGenders: string[];
  jobCategory: string | null;
  batch: number;
  placementYear: number;
  /** ISO-8601 timestamp. */
  registrationDeadline: string;
  description: string | null;
  openingOverview: string | null;
  cap: string | null;
  companyBond: string | null;
  duration: string | null;
  redirectUrl: string | null;
  attachments: { fileName: string; fileUrl: string; mimeType: string; sizeBytes: number }[];
  /** ISO-8601 timestamp. */
  createdAt: string;
  createdById: string;
};

export type BackendAnnouncementAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  /** ISO-8601 timestamp. */
  uploadedAt: string;
};

/**
 * An announcement as `GET /api/v1/announcements` returns it. A student's
 * token only ever draws published rows, so the list needs no status filter
 * of its own — the server decides what the caller may see.
 */
export type BackendAnnouncement = {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  tags: string[];
  company: { id: string; name: string; logoUrl: string | null } | null;
  attachments: BackendAnnouncementAttachment[];
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  publishedAt: string | null;
};

// ---------------------------------------------------------------------------
// Placement calendar (backend/app/schemas/calendar.py)
// ---------------------------------------------------------------------------

export type CalendarEventType =
  | "COMPANY_VISIT"
  | "PRE_PLACEMENT_TALK"
  | "TEST"
  | "INTERVIEW"
  | "DEADLINE"
  | "OTHER"
  | "PERSONAL";

export type CalendarVisibility = "STAFF" | "STUDENTS" | "TARGETED" | "ATTENDEES" | "PRIVATE";

export type CalendarPerson = {
  id: string;
  name: string | null;
  email: string | null;
  rollNumber?: string | null;
  branch?: string | null;
  batch?: number | null;
};

export type BackendCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  /** ISO-8601 with an explicit offset (UTC). */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  meetingLink: string | null;
  companyId: string | null;
  companyName: string | null;
  jobProfileId: string | null;
  jobTitle: string | null;
  visibility: CalendarVisibility;
  targetBatches: number[];
  targetBranches: string[];
  createdById: string;
  createdByName: string | null;
  pocs: CalendarPerson[];
  /** Staff only; null for a student. */
  attendees: CalendarPerson[] | null;
  attendeeCount: number;
  isAttendee: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BackendCalendarSaveResponse = {
  event: BackendCalendarEvent;
  warnings: string[];
};

export type BackendCalendarOptions = {
  staff: CalendarPerson[];
  students: CalendarPerson[];
  companies: { id: string; name: string }[];
  jobs: { id: string; title: string; companyId: string; companyName: string | null; status: string }[];
  batches: number[];
  branches: string[];
};
