from __future__ import annotations

from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=True)

# Auth.js uses HS256 by default with AUTH_SECRET
_ALGORITHMS = ["HS256"]

# ---------------------------------------------------------------------------
# RBAC Permissions Catalog
#
# Permission keys are `module.action`. A `_own` suffix means the holder may
# only reach rows they own; the route is still responsible for the actual
# ownership filter, the permission only says the holder has no wider reach.
#
# This catalog is mirrored in `frontend/src/lib/permissions.ts`. The two must
# stay identical — this side is the enforcement boundary and the frontend only
# decides what to render.
# ---------------------------------------------------------------------------

PERM_ANALYTICS_VIEW = "analytics.view"

PERM_ANNOUNCEMENTS_VIEW = "announcements.view"
PERM_ANNOUNCEMENTS_CREATE = "announcements.create"
PERM_ANNOUNCEMENTS_UPDATE = "announcements.update"
PERM_ANNOUNCEMENTS_PUBLISH = "announcements.publish"
PERM_ANNOUNCEMENTS_DELETE = "announcements.delete"

PERM_COMPANIES_VIEW = "companies.view"
PERM_COMPANIES_CREATE = "companies.create"
PERM_COMPANIES_UPDATE = "companies.update"
PERM_COMPANIES_DELETE = "companies.delete"

PERM_JOBS_VIEW = "jobs.view"
PERM_JOBS_CREATE = "jobs.create"
PERM_JOBS_UPDATE = "jobs.update"
PERM_JOBS_PUBLISH = "jobs.publish"
PERM_JOBS_DELETE = "jobs.delete"

PERM_APPLICATIONS_VIEW = "applications.view"
PERM_APPLICATIONS_VIEW_OWN = "applications.view_own"
PERM_APPLICATIONS_APPLY = "applications.apply"
PERM_APPLICATIONS_UPDATE = "applications.update"

PERM_PLACEMENT_RECORDS_VIEW = "placement_records.view"
PERM_PLACEMENT_RECORDS_VIEW_OWN = "placement_records.view_own"
PERM_PLACEMENT_RECORDS_CREATE = "placement_records.create"
PERM_PLACEMENT_RECORDS_UPDATE = "placement_records.update"
PERM_PLACEMENT_RECORDS_DELETE = "placement_records.delete"

PERM_STUDENTS_VIEW = "students.view"
PERM_STUDENTS_VIEW_OWN = "students.view_own"
PERM_STUDENTS_UPDATE = "students.update"
PERM_STUDENTS_UPDATE_OWN = "students.update_own"

PERM_USERS_VIEW = "users.view"
PERM_USERS_MANAGE = "users.manage"
PERM_RBAC_MANAGE = "rbac.manage"

PERM_NOC_VIEW = "noc.view"
PERM_NOC_VIEW_OWN = "noc.view_own"
PERM_NOC_CREATE = "noc.create"
PERM_NOC_APPROVE = "noc.approve"
PERM_NOC_REJECT = "noc.reject"

PERM_INTERVIEW_EXPERIENCES_VIEW = "interview_experiences.view"
PERM_INTERVIEW_EXPERIENCES_CREATE = "interview_experiences.create"
PERM_INTERVIEW_EXPERIENCES_REVIEW = "interview_experiences.review"
PERM_INTERVIEW_EXPERIENCES_APPROVE = "interview_experiences.approve"
PERM_INTERVIEW_EXPERIENCES_DELETE = "interview_experiences.delete"

PERM_FEEDBACK_VIEW = "feedback.view"
PERM_FEEDBACK_VIEW_OWN = "feedback.view_own"
PERM_FEEDBACK_CREATE = "feedback.create"
PERM_FEEDBACK_RESPOND = "feedback.respond"
PERM_FEEDBACK_RESOLVE = "feedback.resolve"

PERM_TEAM_VIEW = "team.view"
PERM_TEAM_MANAGE = "team.manage"

PERM_SETTINGS_MANAGE = "settings.manage"

ALL_PERMISSIONS = [
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
]

# Permissions that describe a student acting on their own data. Holding only
# these never implies access to the admin portal — see has_any_admin_permission.
STUDENT_SCOPED_PERMISSIONS = [
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
]

_FACULTY_DEFAULTS = [
    PERM_ANALYTICS_VIEW,
    PERM_NOC_VIEW,
    PERM_PLACEMENT_RECORDS_VIEW,
]

_PLACEMENT_VOLUNTEER_DEFAULTS = [
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
]

_PLACEMENT_TEAM_DEFAULTS = [
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
]

ROLE_DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    "SUPER_ADMIN": list(ALL_PERMISSIONS),
    "PLACEMENT_TEAM": list(_PLACEMENT_TEAM_DEFAULTS),
    "PLACEMENT_VOLUNTEER": list(_PLACEMENT_VOLUNTEER_DEFAULTS),
    "FACULTY": list(_FACULTY_DEFAULTS),
    "STUDENT": list(STUDENT_SCOPED_PERMISSIONS),
}

PERMISSION_METADATA = [
    {"key": PERM_ANALYTICS_VIEW, "label": "View Analytics", "category": "Analytics", "description": "Access placement metrics, package charts, and the application funnel."},
    {"key": PERM_ANNOUNCEMENTS_VIEW, "label": "View Announcements", "category": "Announcements", "description": "Read published and draft announcements in the admin portal."},
    {"key": PERM_ANNOUNCEMENTS_CREATE, "label": "Create Announcements", "category": "Announcements", "description": "Compose company-event and general announcements."},
    {"key": PERM_ANNOUNCEMENTS_UPDATE, "label": "Edit Announcements", "category": "Announcements", "description": "Edit existing announcements and their attachments."},
    {"key": PERM_ANNOUNCEMENTS_PUBLISH, "label": "Publish Announcements", "category": "Announcements", "description": "Publish a draft to students, or withdraw a published notice."},
    {"key": PERM_ANNOUNCEMENTS_DELETE, "label": "Delete Announcements", "category": "Announcements", "description": "Permanently remove an announcement and its attachments."},
    {"key": PERM_COMPANIES_VIEW, "label": "View Companies", "category": "Companies", "description": "Browse recruiter companies and their contact details."},
    {"key": PERM_COMPANIES_CREATE, "label": "Add Companies", "category": "Companies", "description": "Register a new recruiter company."},
    {"key": PERM_COMPANIES_UPDATE, "label": "Edit Companies", "category": "Companies", "description": "Update company details and recruiter contacts."},
    {"key": PERM_COMPANIES_DELETE, "label": "Delete Companies", "category": "Companies", "description": "Permanently remove a company record."},
    {"key": PERM_JOBS_VIEW, "label": "View Job Profiles", "category": "Job Profiles", "description": "Browse published and draft placement drives."},
    {"key": PERM_JOBS_CREATE, "label": "Create Job Profiles", "category": "Job Profiles", "description": "Open a new drive and configure its eligibility rules."},
    {"key": PERM_JOBS_UPDATE, "label": "Edit Job Profiles", "category": "Job Profiles", "description": "Edit drive details, deadlines, and eligibility."},
    {"key": PERM_JOBS_PUBLISH, "label": "Publish & Close Drives", "category": "Job Profiles", "description": "Publish a drive to eligible students, or close it."},
    {"key": PERM_JOBS_DELETE, "label": "Delete Job Profiles", "category": "Job Profiles", "description": "Permanently remove a drive."},
    {"key": PERM_APPLICATIONS_VIEW, "label": "View All Applications", "category": "Applications", "description": "Inspect every candidate application across drives."},
    {"key": PERM_APPLICATIONS_VIEW_OWN, "label": "View Own Applications", "category": "Applications", "description": "A student viewing only the applications they submitted."},
    {"key": PERM_APPLICATIONS_APPLY, "label": "Apply to Drives", "category": "Applications", "description": "A student applying to a drive they are eligible for."},
    {"key": PERM_APPLICATIONS_UPDATE, "label": "Manage Application Stages", "category": "Applications", "description": "Progress candidates, bulk-update stages, and export candidate CSVs."},
    {"key": PERM_PLACEMENT_RECORDS_VIEW, "label": "View Placement Records", "category": "Placement Records", "description": "View every recorded offer, PPO, and internship."},
    {"key": PERM_PLACEMENT_RECORDS_VIEW_OWN, "label": "View Own Placement Records", "category": "Placement Records", "description": "A student viewing only their own offers."},
    {"key": PERM_PLACEMENT_RECORDS_CREATE, "label": "Add Placement Records", "category": "Placement Records", "description": "Record a new placement, PPO, or internship offer."},
    {"key": PERM_PLACEMENT_RECORDS_UPDATE, "label": "Edit Placement Records", "category": "Placement Records", "description": "Correct an existing offer record or change its status."},
    {"key": PERM_PLACEMENT_RECORDS_DELETE, "label": "Delete Placement Records", "category": "Placement Records", "description": "Permanently remove an offer record."},
    {"key": PERM_STUDENTS_VIEW, "label": "View Student Directory", "category": "Students", "description": "Search the student register and open academic profiles."},
    {"key": PERM_STUDENTS_VIEW_OWN, "label": "View Own Profile", "category": "Students", "description": "A student viewing their own profile and documents."},
    {"key": PERM_STUDENTS_UPDATE, "label": "Edit Student Records", "category": "Students", "description": "Update roster fields, backlogs, and placement bans."},
    {"key": PERM_STUDENTS_UPDATE_OWN, "label": "Edit Own Profile", "category": "Students", "description": "A student editing the profile fields they own."},
    {"key": PERM_USERS_VIEW, "label": "View Users", "category": "Users & RBAC", "description": "Browse the staff directory and see assigned roles."},
    {"key": PERM_USERS_MANAGE, "label": "Manage Users", "category": "Users & RBAC", "description": "Create accounts, set passwords, suspend and reactivate users."},
    {"key": PERM_RBAC_MANAGE, "label": "Manage Roles & Permissions", "category": "Users & RBAC", "description": "Assign roles and grant or revoke custom permissions. Super Admin only."},
    {"key": PERM_NOC_VIEW, "label": "View NOC Requests", "category": "Forms & NOC", "description": "Read submitted NOC requests and their documents."},
    {"key": PERM_NOC_VIEW_OWN, "label": "View Own NOC Requests", "category": "Forms & NOC", "description": "A student tracking only their own NOC requests."},
    {"key": PERM_NOC_CREATE, "label": "Raise NOC Requests", "category": "Forms & NOC", "description": "A student submitting an NOC request with supporting documents."},
    {"key": PERM_NOC_APPROVE, "label": "Approve NOC Requests", "category": "Forms & NOC", "description": "Approve a pending NOC request."},
    {"key": PERM_NOC_REJECT, "label": "Reject NOC Requests", "category": "Forms & NOC", "description": "Reject a pending NOC request with remarks."},
    {"key": PERM_INTERVIEW_EXPERIENCES_VIEW, "label": "View Interview Experiences", "category": "Interview Experiences", "description": "Read submitted interview experiences."},
    {"key": PERM_INTERVIEW_EXPERIENCES_CREATE, "label": "Submit Interview Experience", "category": "Interview Experiences", "description": "A student submitting their own interview experience."},
    {"key": PERM_INTERVIEW_EXPERIENCES_REVIEW, "label": "Review Interview Experiences", "category": "Interview Experiences", "description": "Open the moderation queue and flag submissions."},
    {"key": PERM_INTERVIEW_EXPERIENCES_APPROVE, "label": "Approve or Reject Experiences", "category": "Interview Experiences", "description": "Publish a submission to students, or reject it."},
    {"key": PERM_INTERVIEW_EXPERIENCES_DELETE, "label": "Delete Interview Experiences", "category": "Interview Experiences", "description": "Remove an inappropriate submission."},
    {"key": PERM_FEEDBACK_VIEW, "label": "View Feedback", "category": "Feedback", "description": "Read student queries, feedback, and complaints."},
    {"key": PERM_FEEDBACK_VIEW_OWN, "label": "View Own Feedback", "category": "Feedback", "description": "A student viewing only the queries they raised."},
    {"key": PERM_FEEDBACK_CREATE, "label": "Submit Feedback", "category": "Feedback", "description": "A student raising a query, feedback, or complaint."},
    {"key": PERM_FEEDBACK_RESPOND, "label": "Respond to Feedback", "category": "Feedback", "description": "Reply to a student query."},
    {"key": PERM_FEEDBACK_RESOLVE, "label": "Resolve Feedback", "category": "Feedback", "description": "Mark a query as resolved and close it."},
    {"key": PERM_TEAM_VIEW, "label": "View Placement Team", "category": "Team", "description": "View the published placement-cell team directory."},
    {"key": PERM_TEAM_MANAGE, "label": "Manage Placement Team", "category": "Team", "description": "Add, edit, reorder, and remove placement-cell team members."},
    {"key": PERM_SETTINGS_MANAGE, "label": "System Settings", "category": "Settings", "description": "Configure portal settings and the administrator allowlist. Super Admin only."},
]


def _decode_token(token: str) -> dict:
    """
    Decode and verify an Auth.js-issued JWT.
    Raises HTTP 401 if the token is invalid or expired.
    """
    try:
        return jwt.decode(token, settings.auth_secret, algorithms=_ALGORITHMS)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _email_of(payload: dict) -> str:
    return (payload.get("email") or "").strip().lower()


# A short-lived, purpose-scoped token minted only by the Next.js server (never
# a browser) to authorize one narrow backend action that has no signed-in
# user yet — currently, sending a registration OTP email. Signed with the
# same AUTH_SECRET as a real session JWT, but never interchangeable with one:
# `purpose` must match exactly, nothing that mints a session sets it, and
# nothing that mints one of these sets `role`/`sub`, so a lifted session
# cannot be replayed here and this token cannot be replayed as a session.
INTERNAL_TOKEN_PURPOSE_REGISTER_OTP_EMAIL = "register-otp-email"


def _decode_internal_purpose_token(token: str, expected_purpose: str) -> dict:
    try:
        payload = jwt.decode(token, settings.auth_secret, algorithms=_ALGORITHMS)
    except (ExpiredSignatureError, JWTError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired internal token.",
        )
    if payload.get("purpose") != expected_purpose:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired internal token.",
        )
    return payload


def require_internal_purpose_token(purpose: str) -> Callable:
    """Dependency factory for an internal, purpose-scoped token. Mirrors require_permission's shape."""

    def _dependency(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ) -> dict:
        return _decode_internal_purpose_token(credentials.credentials, purpose)

    return _dependency


def is_admin_email(email: str) -> bool:
    """ADMIN_EMAILS is the bootstrap source of administrator access."""
    return bool(email) and email in settings.admin_email_set


def is_student_email(email: str) -> bool:
    _, _, domain = email.partition("@")
    return bool(domain) and domain == settings.normalized_student_domain


def is_elevated_role(role: str) -> bool:
    # Deliberately excludes FACULTY: this is the broad "trust this role for
    # anything not explicitly permission-gated" shortcut (see its use in
    # has_any_admin_permission and the frontend's canAccessAdminRoute
    # fallback), and faculty access is meant to stay limited to exactly the
    # permissions in _FACULTY_DEFAULTS. Faculty still reach the admin portal
    # and their three routes correctly through has_any_admin_permission's
    # permission-based branch below, not through this one.
    return role in ("PLACEMENT_VOLUNTEER", "PLACEMENT_TEAM", "SUPER_ADMIN")


def compute_effective_permissions(
    role: str,
    custom_permissions: list[str] | None = None,
    email: str | None = None,
) -> list[str]:
    """
    Compute full effective permissions for a role, combining role defaults
    and explicit custom permissions.
    """
    if email and is_admin_email(email):
        return list(ALL_PERMISSIONS)
    if role == "SUPER_ADMIN":
        return list(ALL_PERMISSIONS)

    base = set(ROLE_DEFAULT_PERMISSIONS.get(role, []))
    if custom_permissions:
        for perm in custom_permissions:
            if perm.startswith("-"):
                base.discard(perm[1:])
            elif perm in ALL_PERMISSIONS:
                base.add(perm)
    return sorted(list(base))


def _effective_permissions_of(payload: dict) -> list[str]:
    token_perms = payload.get("permissions")
    if token_perms is not None:
        return list(token_perms)
    return compute_effective_permissions(
        payload.get("role", "STUDENT"),
        payload.get("customPermissions", []),
        _email_of(payload),
    )


def has_permission(payload: dict, permission: str) -> bool:
    """
    Check if a JWT payload possesses a given permission.
    """
    email = _email_of(payload)
    if is_admin_email(email) or payload.get("role") == "SUPER_ADMIN":
        return True
    return permission in _effective_permissions_of(payload)


def has_any_admin_permission(payload: dict) -> bool:
    """
    Whether the caller may reach administrative endpoints at all.

    This inspects *which* permissions are held, not how many. Students hold
    `_own` permissions by default, so a non-empty permission list is never on
    its own evidence of administrative access.
    """
    email = _email_of(payload)
    if is_admin_email(email):
        return True
    if is_elevated_role(payload.get("role", "STUDENT")):
        return True

    # Only keys in the current catalog count. A token issued before a catalog
    # change carries keys that no longer exist (the pre-2026-09-17 `users:read`
    # and friends); an unrecognised string must not read as administrative.
    student_scoped = set(STUDENT_SCOPED_PERMISSIONS)
    known = set(ALL_PERMISSIONS)
    return any(
        perm in known and perm not in student_scoped
        for perm in _effective_permissions_of(payload)
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Dependency: decode the bearer JWT and return the full payload.
    Rejects accounts not permitted to use the placement portal or deactivated accounts.
    """
    payload = _decode_token(credentials.credentials)
    email = _email_of(payload)
    role = payload.get("role", "STUDENT")
    if not (is_student_email(email) or is_admin_email(email) or is_elevated_role(role)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not permitted to use the placement portal.",
        )
    if payload.get("isActive") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )
    return payload


def require_student(
    payload: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency: asserts the caller is a student.
    """
    if payload.get("role") != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access is required for this resource.",
        )
    return payload


def require_admin(
    payload: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency: asserts the caller may reach the administrative portal.

    Prefer `require_permission(...)` for anything specific — this only answers
    "is this an administrative account at all", which is rarely the question a
    route actually wants to ask.
    """
    if not has_any_admin_permission(payload):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required for this resource.",
        )
    return payload


def require_permission(permission: str) -> Callable:
    """
    Dependency factory: asserts the caller has a specific RBAC permission.
    """
    def _dependency(payload: dict = Depends(get_current_user)) -> dict:
        if not has_permission(payload, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' is required for this resource.",
            )
        return payload

    return _dependency


def require_any_permission(*permissions: str) -> Callable:
    """
    Dependency factory: asserts the caller holds at least one of `permissions`.
    Used where a screen is reachable by either a read or a manage grant.
    """
    def _dependency(payload: dict = Depends(get_current_user)) -> dict:
        if not any(has_permission(payload, perm) for perm in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of {', '.join(permissions)} is required for this resource.",
            )
        return payload

    return _dependency
