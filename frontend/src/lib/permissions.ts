import type { Role } from "@prisma/client";
import { isAdminEmail } from "./auth-access";

/**
 * Permission keys are `module.action`. A `_own` suffix means the holder may
 * only reach rows they own; the route is still responsible for the actual
 * ownership filter, the permission only says the holder has no wider reach.
 *
 * This catalog is mirrored in `backend/app/core/security.py`. The two must
 * stay identical — the backend is the enforcement boundary and the frontend
 * only decides what to render.
 */

export const PERM_ANALYTICS_VIEW = "analytics.view";

export const PERM_ANNOUNCEMENTS_VIEW = "announcements.view";
export const PERM_ANNOUNCEMENTS_CREATE = "announcements.create";
export const PERM_ANNOUNCEMENTS_UPDATE = "announcements.update";
export const PERM_ANNOUNCEMENTS_PUBLISH = "announcements.publish";
export const PERM_ANNOUNCEMENTS_DELETE = "announcements.delete";

export const PERM_COMPANIES_VIEW = "companies.view";
export const PERM_COMPANIES_CREATE = "companies.create";
export const PERM_COMPANIES_UPDATE = "companies.update";
export const PERM_COMPANIES_DELETE = "companies.delete";

export const PERM_JOBS_VIEW = "jobs.view";
export const PERM_JOBS_CREATE = "jobs.create";
export const PERM_JOBS_UPDATE = "jobs.update";
export const PERM_JOBS_PUBLISH = "jobs.publish";
export const PERM_JOBS_DELETE = "jobs.delete";

export const PERM_APPLICATIONS_VIEW = "applications.view";
export const PERM_APPLICATIONS_VIEW_OWN = "applications.view_own";
export const PERM_APPLICATIONS_APPLY = "applications.apply";
export const PERM_APPLICATIONS_UPDATE = "applications.update";

export const PERM_PLACEMENT_RECORDS_VIEW = "placement_records.view";
export const PERM_PLACEMENT_RECORDS_VIEW_OWN = "placement_records.view_own";
export const PERM_PLACEMENT_RECORDS_CREATE = "placement_records.create";
export const PERM_PLACEMENT_RECORDS_UPDATE = "placement_records.update";
export const PERM_PLACEMENT_RECORDS_DELETE = "placement_records.delete";

export const PERM_STUDENTS_VIEW = "students.view";
export const PERM_STUDENTS_VIEW_OWN = "students.view_own";
export const PERM_STUDENTS_UPDATE = "students.update";
export const PERM_STUDENTS_UPDATE_OWN = "students.update_own";

export const PERM_USERS_VIEW = "users.view";
export const PERM_USERS_MANAGE = "users.manage";
export const PERM_RBAC_MANAGE = "rbac.manage";

export const PERM_NOC_VIEW = "noc.view";
export const PERM_NOC_VIEW_OWN = "noc.view_own";
export const PERM_NOC_CREATE = "noc.create";
export const PERM_NOC_APPROVE = "noc.approve";
export const PERM_NOC_REJECT = "noc.reject";

export const PERM_INTERVIEW_EXPERIENCES_VIEW = "interview_experiences.view";
export const PERM_INTERVIEW_EXPERIENCES_CREATE = "interview_experiences.create";
export const PERM_INTERVIEW_EXPERIENCES_REVIEW = "interview_experiences.review";
export const PERM_INTERVIEW_EXPERIENCES_APPROVE = "interview_experiences.approve";
export const PERM_INTERVIEW_EXPERIENCES_DELETE = "interview_experiences.delete";

export const PERM_FEEDBACK_VIEW = "feedback.view";
export const PERM_FEEDBACK_VIEW_OWN = "feedback.view_own";
export const PERM_FEEDBACK_CREATE = "feedback.create";
export const PERM_FEEDBACK_RESPOND = "feedback.respond";
export const PERM_FEEDBACK_RESOLVE = "feedback.resolve";

export const PERM_TEAM_VIEW = "team.view";
export const PERM_TEAM_MANAGE = "team.manage";

export const PERM_SETTINGS_MANAGE = "settings.manage";

export const ALL_PERMISSIONS = [
  PERM_ANALYTICS_VIEW,
  PERM_ANNOUNCEMENTS_VIEW,
  PERM_ANNOUNCEMENTS_CREATE,
  PERM_ANNOUNCEMENTS_UPDATE,
  PERM_ANNOUNCEMENTS_PUBLISH,
  PERM_ANNOUNCEMENTS_DELETE,
  PERM_COMPANIES_VIEW,
  PERM_COMPANIES_CREATE,
  PERM_COMPANIES_UPDATE,
  PERM_COMPANIES_DELETE,
  PERM_JOBS_VIEW,
  PERM_JOBS_CREATE,
  PERM_JOBS_UPDATE,
  PERM_JOBS_PUBLISH,
  PERM_JOBS_DELETE,
  PERM_APPLICATIONS_VIEW,
  PERM_APPLICATIONS_VIEW_OWN,
  PERM_APPLICATIONS_APPLY,
  PERM_APPLICATIONS_UPDATE,
  PERM_PLACEMENT_RECORDS_VIEW,
  PERM_PLACEMENT_RECORDS_VIEW_OWN,
  PERM_PLACEMENT_RECORDS_CREATE,
  PERM_PLACEMENT_RECORDS_UPDATE,
  PERM_PLACEMENT_RECORDS_DELETE,
  PERM_STUDENTS_VIEW,
  PERM_STUDENTS_VIEW_OWN,
  PERM_STUDENTS_UPDATE,
  PERM_STUDENTS_UPDATE_OWN,
  PERM_USERS_VIEW,
  PERM_USERS_MANAGE,
  PERM_RBAC_MANAGE,
  PERM_NOC_VIEW,
  PERM_NOC_VIEW_OWN,
  PERM_NOC_CREATE,
  PERM_NOC_APPROVE,
  PERM_NOC_REJECT,
  PERM_INTERVIEW_EXPERIENCES_VIEW,
  PERM_INTERVIEW_EXPERIENCES_CREATE,
  PERM_INTERVIEW_EXPERIENCES_REVIEW,
  PERM_INTERVIEW_EXPERIENCES_APPROVE,
  PERM_INTERVIEW_EXPERIENCES_DELETE,
  PERM_FEEDBACK_VIEW,
  PERM_FEEDBACK_VIEW_OWN,
  PERM_FEEDBACK_CREATE,
  PERM_FEEDBACK_RESPOND,
  PERM_FEEDBACK_RESOLVE,
  PERM_TEAM_VIEW,
  PERM_TEAM_MANAGE,
  PERM_SETTINGS_MANAGE,
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export type PermissionCategory =
  | "Analytics"
  | "Announcements"
  | "Companies"
  | "Job Profiles"
  | "Applications"
  | "Placement Records"
  | "Students"
  | "Users & RBAC"
  | "Forms & NOC"
  | "Interview Experiences"
  | "Feedback"
  | "Team"
  | "Settings";

export type PermissionDefinition = {
  key: PermissionKey;
  label: string;
  category: PermissionCategory;
  description: string;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: PERM_ANALYTICS_VIEW, label: "View Analytics", category: "Analytics", description: "Access placement metrics, package charts, and the application funnel." },

  { key: PERM_ANNOUNCEMENTS_VIEW, label: "View Announcements", category: "Announcements", description: "Read published and draft announcements in the admin portal." },
  { key: PERM_ANNOUNCEMENTS_CREATE, label: "Create Announcements", category: "Announcements", description: "Compose company-event and general announcements." },
  { key: PERM_ANNOUNCEMENTS_UPDATE, label: "Edit Announcements", category: "Announcements", description: "Edit existing announcements and their attachments." },
  { key: PERM_ANNOUNCEMENTS_PUBLISH, label: "Publish Announcements", category: "Announcements", description: "Publish a draft to students, or withdraw a published notice." },
  { key: PERM_ANNOUNCEMENTS_DELETE, label: "Delete Announcements", category: "Announcements", description: "Permanently remove an announcement and its attachments." },

  { key: PERM_COMPANIES_VIEW, label: "View Companies", category: "Companies", description: "Browse recruiter companies and their contact details." },
  { key: PERM_COMPANIES_CREATE, label: "Add Companies", category: "Companies", description: "Register a new recruiter company." },
  { key: PERM_COMPANIES_UPDATE, label: "Edit Companies", category: "Companies", description: "Update company details and recruiter contacts." },
  { key: PERM_COMPANIES_DELETE, label: "Delete Companies", category: "Companies", description: "Permanently remove a company record." },

  { key: PERM_JOBS_VIEW, label: "View Job Profiles", category: "Job Profiles", description: "Browse published and draft placement drives." },
  { key: PERM_JOBS_CREATE, label: "Create Job Profiles", category: "Job Profiles", description: "Open a new drive and configure its eligibility rules." },
  { key: PERM_JOBS_UPDATE, label: "Edit Job Profiles", category: "Job Profiles", description: "Edit drive details, deadlines, and eligibility." },
  { key: PERM_JOBS_PUBLISH, label: "Publish & Close Drives", category: "Job Profiles", description: "Publish a drive to eligible students, or close it." },
  { key: PERM_JOBS_DELETE, label: "Delete Job Profiles", category: "Job Profiles", description: "Permanently remove a drive." },

  { key: PERM_APPLICATIONS_VIEW, label: "View All Applications", category: "Applications", description: "Inspect every candidate application across drives." },
  { key: PERM_APPLICATIONS_VIEW_OWN, label: "View Own Applications", category: "Applications", description: "A student viewing only the applications they submitted." },
  { key: PERM_APPLICATIONS_APPLY, label: "Apply to Drives", category: "Applications", description: "A student applying to a drive they are eligible for." },
  { key: PERM_APPLICATIONS_UPDATE, label: "Manage Application Stages", category: "Applications", description: "Progress candidates, bulk-update stages, and export candidate CSVs." },

  { key: PERM_PLACEMENT_RECORDS_VIEW, label: "View Placement Records", category: "Placement Records", description: "View every recorded offer, PPO, and internship." },
  { key: PERM_PLACEMENT_RECORDS_VIEW_OWN, label: "View Own Placement Records", category: "Placement Records", description: "A student viewing only their own offers." },
  { key: PERM_PLACEMENT_RECORDS_CREATE, label: "Add Placement Records", category: "Placement Records", description: "Record a new placement, PPO, or internship offer." },
  { key: PERM_PLACEMENT_RECORDS_UPDATE, label: "Edit Placement Records", category: "Placement Records", description: "Correct an existing offer record or change its status." },
  { key: PERM_PLACEMENT_RECORDS_DELETE, label: "Delete Placement Records", category: "Placement Records", description: "Permanently remove an offer record." },

  { key: PERM_STUDENTS_VIEW, label: "View Student Directory", category: "Students", description: "Search the student register and open academic profiles." },
  { key: PERM_STUDENTS_VIEW_OWN, label: "View Own Profile", category: "Students", description: "A student viewing their own profile and documents." },
  { key: PERM_STUDENTS_UPDATE, label: "Edit Student Records", category: "Students", description: "Update roster fields, backlogs, and placement bans." },
  { key: PERM_STUDENTS_UPDATE_OWN, label: "Edit Own Profile", category: "Students", description: "A student editing the profile fields they own." },

  { key: PERM_USERS_VIEW, label: "View Users", category: "Users & RBAC", description: "Browse the staff directory and see assigned roles." },
  { key: PERM_USERS_MANAGE, label: "Manage Users", category: "Users & RBAC", description: "Create accounts, set passwords, suspend and reactivate users." },
  { key: PERM_RBAC_MANAGE, label: "Manage Roles & Permissions", category: "Users & RBAC", description: "Assign roles and grant or revoke custom permissions. Super Admin only." },

  { key: PERM_NOC_VIEW, label: "View NOC Requests", category: "Forms & NOC", description: "Read submitted NOC requests and their documents." },
  { key: PERM_NOC_VIEW_OWN, label: "View Own NOC Requests", category: "Forms & NOC", description: "A student tracking only their own NOC requests." },
  { key: PERM_NOC_CREATE, label: "Raise NOC Requests", category: "Forms & NOC", description: "A student submitting an NOC request with supporting documents." },
  { key: PERM_NOC_APPROVE, label: "Approve NOC Requests", category: "Forms & NOC", description: "Approve a pending NOC request." },
  { key: PERM_NOC_REJECT, label: "Reject NOC Requests", category: "Forms & NOC", description: "Reject a pending NOC request with remarks." },

  { key: PERM_INTERVIEW_EXPERIENCES_VIEW, label: "View Interview Experiences", category: "Interview Experiences", description: "Read submitted interview experiences." },
  { key: PERM_INTERVIEW_EXPERIENCES_CREATE, label: "Submit Interview Experience", category: "Interview Experiences", description: "A student submitting their own interview experience." },
  { key: PERM_INTERVIEW_EXPERIENCES_REVIEW, label: "Review Interview Experiences", category: "Interview Experiences", description: "Open the moderation queue and flag submissions." },
  { key: PERM_INTERVIEW_EXPERIENCES_APPROVE, label: "Approve or Reject Experiences", category: "Interview Experiences", description: "Publish a submission to students, or reject it." },
  { key: PERM_INTERVIEW_EXPERIENCES_DELETE, label: "Delete Interview Experiences", category: "Interview Experiences", description: "Remove an inappropriate submission." },

  { key: PERM_FEEDBACK_VIEW, label: "View Feedback", category: "Feedback", description: "Read student queries, feedback, and complaints." },
  { key: PERM_FEEDBACK_VIEW_OWN, label: "View Own Feedback", category: "Feedback", description: "A student viewing only the queries they raised." },
  { key: PERM_FEEDBACK_CREATE, label: "Submit Feedback", category: "Feedback", description: "A student raising a query, feedback, or complaint." },
  { key: PERM_FEEDBACK_RESPOND, label: "Respond to Feedback", category: "Feedback", description: "Reply to a student query." },
  { key: PERM_FEEDBACK_RESOLVE, label: "Resolve Feedback", category: "Feedback", description: "Mark a query as resolved and close it." },

  { key: PERM_TEAM_VIEW, label: "View Placement Team", category: "Team", description: "View the published placement-cell team directory." },
  { key: PERM_TEAM_MANAGE, label: "Manage Placement Team", category: "Team", description: "Add, edit, reorder, and remove placement-cell team members." },

  { key: PERM_SETTINGS_MANAGE, label: "System Settings", category: "Settings", description: "Configure portal settings and the administrator allowlist. Super Admin only." },
];

/**
 * Granted to a user when they are linked to a placement-team directory entry.
 * Mirrors `DEFAULT_PLACEMENT_TEAM_PERMISSIONS` in `backend/app/routers/team.py`,
 * which is the copy that actually writes them; this one drives the UI that
 * shows an administrator what linking will grant.
 */
export const DEFAULT_PLACEMENT_TEAM_PERMISSIONS: readonly PermissionKey[] = [
  PERM_COMPANIES_VIEW,
  PERM_JOBS_VIEW,
  PERM_JOBS_CREATE,
  PERM_JOBS_UPDATE,
  PERM_JOBS_PUBLISH,
  PERM_APPLICATIONS_VIEW,
  PERM_APPLICATIONS_UPDATE,
  PERM_STUDENTS_VIEW,
  PERM_ANNOUNCEMENTS_VIEW,
  PERM_ANNOUNCEMENTS_CREATE,
  PERM_ANNOUNCEMENTS_UPDATE,
  PERM_ANNOUNCEMENTS_PUBLISH,
  PERM_ANALYTICS_VIEW,
];

/**
 * Permissions that describe a student acting on their own data. Holding only
 * these never implies access to the admin portal — see `hasAnyAdminPermission`.
 */
export const STUDENT_SCOPED_PERMISSIONS: readonly PermissionKey[] = [
  PERM_ANNOUNCEMENTS_VIEW,
  PERM_COMPANIES_VIEW,
  PERM_JOBS_VIEW,
  PERM_APPLICATIONS_VIEW_OWN,
  PERM_APPLICATIONS_APPLY,
  PERM_PLACEMENT_RECORDS_VIEW_OWN,
  PERM_STUDENTS_VIEW_OWN,
  PERM_STUDENTS_UPDATE_OWN,
  PERM_NOC_VIEW_OWN,
  PERM_NOC_CREATE,
  PERM_INTERVIEW_EXPERIENCES_VIEW,
  PERM_INTERVIEW_EXPERIENCES_CREATE,
  PERM_FEEDBACK_VIEW_OWN,
  PERM_FEEDBACK_CREATE,
];

const STUDENT_DEFAULTS: readonly PermissionKey[] = STUDENT_SCOPED_PERMISSIONS;

const PLACEMENT_VOLUNTEER_DEFAULTS: readonly PermissionKey[] = [
  PERM_ANALYTICS_VIEW,
  PERM_ANNOUNCEMENTS_VIEW,
  PERM_COMPANIES_VIEW,
  PERM_JOBS_VIEW,
  PERM_APPLICATIONS_VIEW,
  PERM_PLACEMENT_RECORDS_VIEW,
  PERM_STUDENTS_VIEW,
  PERM_NOC_VIEW,
  PERM_INTERVIEW_EXPERIENCES_VIEW,
  PERM_INTERVIEW_EXPERIENCES_REVIEW,
  PERM_FEEDBACK_VIEW,
  PERM_FEEDBACK_RESPOND,
  PERM_TEAM_VIEW,
];

const PLACEMENT_TEAM_DEFAULTS: readonly PermissionKey[] = [
  PERM_ANALYTICS_VIEW,
  PERM_ANNOUNCEMENTS_VIEW,
  PERM_ANNOUNCEMENTS_CREATE,
  PERM_ANNOUNCEMENTS_UPDATE,
  PERM_ANNOUNCEMENTS_PUBLISH,
  PERM_COMPANIES_VIEW,
  PERM_COMPANIES_CREATE,
  PERM_COMPANIES_UPDATE,
  PERM_JOBS_VIEW,
  PERM_JOBS_CREATE,
  PERM_JOBS_UPDATE,
  PERM_JOBS_PUBLISH,
  PERM_APPLICATIONS_VIEW,
  PERM_APPLICATIONS_UPDATE,
  PERM_PLACEMENT_RECORDS_VIEW,
  PERM_PLACEMENT_RECORDS_CREATE,
  PERM_PLACEMENT_RECORDS_UPDATE,
  PERM_STUDENTS_VIEW,
  PERM_STUDENTS_UPDATE,
  PERM_USERS_VIEW,
  PERM_NOC_VIEW,
  PERM_NOC_APPROVE,
  PERM_NOC_REJECT,
  PERM_INTERVIEW_EXPERIENCES_VIEW,
  PERM_INTERVIEW_EXPERIENCES_REVIEW,
  PERM_INTERVIEW_EXPERIENCES_APPROVE,
  PERM_INTERVIEW_EXPERIENCES_DELETE,
  PERM_FEEDBACK_VIEW,
  PERM_FEEDBACK_RESPOND,
  PERM_FEEDBACK_RESOLVE,
  PERM_TEAM_VIEW,
  PERM_TEAM_MANAGE,
];

/**
 * `SUPER_ADMIN` is not listed: it is answered by `computeEffectivePermissions`
 * returning the whole catalog, so a new permission is granted to it by
 * existing, rather than by being added here and forgotten.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly PermissionKey[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  PLACEMENT_TEAM: PLACEMENT_TEAM_DEFAULTS,
  PLACEMENT_VOLUNTEER: PLACEMENT_VOLUNTEER_DEFAULTS,
  STUDENT: STUDENT_DEFAULTS,
};

export const ROLE_METADATA: Record<
  Role,
  { label: string; description: string; badgeClass: string; tier: number }
> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    description: "Unrestricted access. The only role that can assign roles or change permissions.",
    badgeClass: "badge-superadmin",
    tier: 4,
  },
  PLACEMENT_TEAM: {
    label: "Placement Team",
    description: "Runs the placement cell day to day: drives, applications, records, and approvals.",
    badgeClass: "badge-placement-team",
    tier: 3,
  },
  PLACEMENT_VOLUNTEER: {
    label: "Placement Volunteer",
    description: "Assists the team with read access to placement data; cannot change it.",
    badgeClass: "badge-placement-volunteer",
    tier: 2,
  },
  STUDENT: {
    label: "Student",
    description: "Registered student applying to drives and managing their own records.",
    badgeClass: "badge-student",
    tier: 1,
  },
};

export function isElevatedRole(role: Role | string | null | undefined): boolean {
  if (!role) return false;
  return role === "SUPER_ADMIN" || role === "PLACEMENT_TEAM" || role === "PLACEMENT_VOLUNTEER";
}

export function computeEffectivePermissions(
  role: Role | string,
  customPermissions: string[] = [],
  email?: string | null,
): string[] {
  if (email && isAdminEmail(email)) {
    return Array.from(ALL_PERMISSIONS);
  }
  if (role === "SUPER_ADMIN") {
    return Array.from(ALL_PERMISSIONS);
  }

  const baseSet = new Set<string>(ROLE_DEFAULT_PERMISSIONS[role as Role] ?? []);

  for (const perm of customPermissions) {
    if (perm.startsWith("-")) {
      baseSet.delete(perm.slice(1));
    } else if ((ALL_PERMISSIONS as readonly string[]).includes(perm)) {
      baseSet.add(perm);
    }
  }

  return Array.from(baseSet).sort();
}

type PermissionSubject = {
  role?: Role | string;
  customPermissions?: string[];
  effectivePermissions?: string[];
  email?: string | null;
} | null | undefined;

function effectivePermissionsOf(user: NonNullable<PermissionSubject>): string[] {
  if (user.effectivePermissions) return user.effectivePermissions;
  return computeEffectivePermissions(
    user.role ?? "STUDENT",
    user.customPermissions ?? [],
    user.email,
  );
}

export function hasPermission(user: PermissionSubject, permission: PermissionKey): boolean {
  if (!user) return false;
  if (user.email && isAdminEmail(user.email)) return true;
  if (user.role === "SUPER_ADMIN") return true;

  return effectivePermissionsOf(user).includes(permission);
}

/**
 * Whether the account may reach the admin portal at all.
 *
 * This deliberately inspects *which* permissions are held rather than how many.
 * The previous `customPermissions.length > 0` test meant that granting a
 * student any permission — including a revocation like `-jobs.view` — let them
 * through the admin gate, which in turn set `isAuthorized` on the resume and
 * NOC document routes and skipped their ownership checks entirely. Students
 * now hold `_own` permissions by default, so a count is never a safe signal.
 */
export function hasAnyAdminPermission(user: PermissionSubject): boolean {
  if (!user) return false;
  if (user.email && isAdminEmail(user.email)) return true;
  if (isElevatedRole(user.role)) return true;

  // Only keys in the current catalog count. A session issued before a catalog
  // change carries keys that no longer exist (the pre-2026-09-17 `users:read`
  // and friends); an unrecognised string must not read as administrative.
  const studentScoped = new Set<string>(STUDENT_SCOPED_PERMISSIONS);
  const known = new Set<string>(ALL_PERMISSIONS);
  return effectivePermissionsOf(user).some(
    (perm) => known.has(perm) && !studentScoped.has(perm),
  );
}

/**
 * Every admin route, and the permissions any one of which grants access. This
 * is also the source for the admin sidebar: a route missing from here is
 * hidden from the navigation, so a new admin page must be registered before it
 * becomes reachable.
 */
export const ROUTE_PERMISSIONS: Record<string, PermissionKey[]> = {
  "/admin/dashboard": [PERM_ANALYTICS_VIEW],
  "/admin/users": [PERM_USERS_VIEW, PERM_USERS_MANAGE, PERM_RBAC_MANAGE],
  "/admin/companies": [PERM_COMPANIES_VIEW],
  // Events were called job profiles until 2026-09-17; the old path is a
  // redirect and still needs to be reachable to answer with one.
  "/admin/job-profiles": [PERM_JOBS_VIEW],
  "/admin/events": [PERM_JOBS_VIEW],
  "/admin/events/add": [PERM_JOBS_CREATE],
  "/admin/applications": [PERM_APPLICATIONS_VIEW],
  "/admin/placement-records": [PERM_PLACEMENT_RECORDS_VIEW],
  "/admin/students": [PERM_STUDENTS_VIEW],
  "/admin/announcements": [PERM_ANNOUNCEMENTS_VIEW],
  "/admin/announcements/company-event": [PERM_ANNOUNCEMENTS_CREATE],
  "/admin/announcements/general": [PERM_ANNOUNCEMENTS_CREATE],
  "/admin/feedbacks": [PERM_FEEDBACK_VIEW],
  "/admin/noc-requests": [PERM_NOC_VIEW],
  "/admin/interview-experiences": [PERM_INTERVIEW_EXPERIENCES_VIEW],
  // team.view covers the public directory at /team. The admin console is a
  // full CRUD screen with no read-only mode, so it takes team.manage — the
  // sidebar reads this table, and offering a link that the page then refuses
  // is worse than not offering it.
  "/admin/team": [PERM_TEAM_MANAGE],
  "/admin/settings": [PERM_SETTINGS_MANAGE],
};

export function canAccessAdminRoute(user: PermissionSubject, pathname: string): boolean {
  if (!user) return false;
  if (user.email && isAdminEmail(user.email)) return true;
  if (user.role === "SUPER_ADMIN") return true;

  // Some route permissions are also held by students — `companies.view` and
  // `jobs.view` are how a student browses drives. Requiring admin-area access
  // first is what keeps those keys from doubling as an admin pass, and keeps
  // this answer consistent with the gate in the middleware.
  if (!hasAnyAdminPermission(user)) return false;

  // Longest prefix wins. `/admin/announcements/company-event` is a composer
  // and needs `announcements.create`; matching the first entry instead would
  // let its parent `/admin/announcements` answer for it with mere view access.
  let matched: PermissionKey[] | null = null;
  let matchedLength = -1;
  for (const [prefix, requiredPerms] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (prefix.length > matchedLength) {
        matched = requiredPerms;
        matchedLength = prefix.length;
      }
    }
  }
  if (matched) {
    return matched.some((perm) => hasPermission(user, perm));
  }

  return isElevatedRole(user.role);
}

/**
 * The route to send someone to when they land on an admin page they cannot
 * open. Redirecting unconditionally to `/admin/dashboard` loops forever for an
 * account that cannot open the dashboard either.
 */
export function firstAccessibleAdminRoute(user: PermissionSubject): string | null {
  for (const prefix of Object.keys(ROUTE_PERMISSIONS)) {
    if (canAccessAdminRoute(user, prefix)) return prefix;
  }
  return null;
}
