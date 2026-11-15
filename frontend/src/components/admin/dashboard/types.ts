/**
 * Shapes the admin dashboard reads. Every one mirrors a response the backend
 * already serves; nothing here is computed from invented data.
 */

export type AmountStats = {
  count: number;
  average: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
};

export type Distribution = { label: string; count: number };

export type Recruiter = Distribution & { placements: number; internships: number };

export type ApplicationFunnel = {
  total: number;
  /** Currently at each stage. */
  applied: number;
  shortlisted: number;
  interviews: number;
  selected: number;
  rejected: number;
  withdrawn: number;
  offerAccepted: number;
  offerDeclined: number;
  /** At that stage or any later one: a floor, since history is not kept. */
  reachedShortlist: number;
  reachedInterview: number;
  reachedSelection: number;
  /** Selected students with no offer from that company on file this season. */
  selectedWithoutOffer: number;
};

export type AdminOverview = {
  season: number | null;
  seasons: number[];
  totals: {
    students: number;
    seasonStudents: number;
    companies: number;
    activeJobs: number;
    placements: number;
    internships: number;
    placedStudents: number;
    placementRate: number;
    recruiters: number;
    placementRecruiters: number;
  };
  packages: {
    placement: AmountStats;
    ppo: AmountStats;
    combined: AmountStats;
    internship: AmountStats;
  };
  /** Internship-side headline counts, derived from the offers on file. */
  internshipSummary: {
    studentsWithOffers: number;
    /** Season students holding no counted offer of any kind. */
    eligibleStudents: number;
    topRecruiter: { label: string; count: number } | null;
    recruiters: Distribution[];
  };
  /** Internship-to-full-time conversion, derived from the offers on file. */
  conversion: {
    converted: number;
    interns: number;
    rate: number;
    ppoWithoutInternship: number;
  };
  placementsByDegree: Distribution[];
  internshipsByDegree: Distribution[];
  internshipsByBranch: Distribution[];
  placementsByBranch: Distribution[];
  topRecruiters: Recruiter[];
  applicationFunnel: ApplicationFunnel;
  recentApplications: Array<{
    id: string;
    student: string;
    role: string;
    company: string;
    status: string;
    updatedAt: string | null;
  }>;
  /** Clock-dependent figures, outside the cached season payload. */
  live: { openDrives: number };
};

export type NocItem = {
  id: string;
  company: string;
  status: string;
  source: string;
  createdAt: string;
  student?: { name?: string | null; rollNumber?: string | null } | null;
};

export type NocMetrics = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  notRequired: number;
};

export type FeedbackItem = {
  id: string;
  feedbackType: string;
  content: string;
  /** Parsed from `content` by the API; `content` itself can be a JSON envelope. */
  subject?: string | null;
  message?: string | null;
  resolved: boolean;
  createdAt: string;
  student?: { name?: string | null; rollNumber?: string | null } | null;
};

export type CalendarItem = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  companyName?: string | null;
  location?: string | null;
};

export type UpcomingDrive = {
  id: string;
  title: string;
  company: string;
  type: string;
  batch: number;
  registrationDeadline: string;
  applications: number;
};

/**
 * One block of the dashboard that has its own data source. `hidden` means the
 * viewer lacks the permission (so the block is not drawn at all); `error`
 * means it could not be loaded, which must never blank the rest of the page.
 */
export type Panel<T> = { status: "hidden" } | { status: "error" } | { status: "ok"; data: T };

export type QuickActionKey =
  | "record-placement"
  | "add-event"
  | "announce"
  | "add-company"
  | "calendar"
  | "review-nocs"
  | "review-applications";

export type DashboardExtras = {
  noc: Panel<{ metrics: NocMetrics; pending: NocItem[]; recent: NocItem[] }>;
  queries: Panel<{ pendingCount: number; pending: FeedbackItem[]; recent: FeedbackItem[] }>;
  calendar: Panel<CalendarItem[]>;
  drives: Panel<UpcomingDrive[]>;
  actions: QuickActionKey[];
  /** Whether the viewer may open the record-placement screen, for pipeline hints. */
  canRecordPlacements: boolean;
};

const IST = "Asia/Kolkata";

const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: IST });
const dayMonthTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: IST,
});

export function formatDay(iso: string | null | undefined): string {
  return iso ? dayMonth.format(new Date(iso)) : "—";
}

export function formatDayTime(iso: string): string {
  return dayMonthTime.format(new Date(iso));
}

/** Whole days elapsed since `iso`; never negative. */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export function agePhrase(iso: string, now = Date.now()): string {
  const days = daysSince(iso, now);
  if (days >= 1) return `${days}d`;
  const hours = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  return hours >= 1 ? `${hours}h` : "just now";
}

/** "closes in 3d" / "closes today": how long until `iso`, rounded down. */
export function untilPhrase(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "now";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `in ${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 1 ? `in ${hours}h` : "within the hour";
}

export function personName(student: { name?: string | null; rollNumber?: string | null } | null | undefined): string {
  return student?.name?.trim() || student?.rollNumber?.trim() || "Student";
}

export const CALENDAR_TYPE_LABELS: Record<string, string> = {
  COMPANY_VISIT: "Company visit",
  PRE_PLACEMENT_TALK: "Pre-placement talk",
  TEST: "Test",
  INTERVIEW: "Interview",
  DEADLINE: "Deadline",
  OTHER: "Other",
  PERSONAL: "Personal",
};

export const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  QUERY: "Query",
  FEEDBACK: "Feedback",
  COMPLAINT: "Complaint",
};
