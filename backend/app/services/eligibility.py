"""
Eligibility engine — Python port of src/lib/eligibility.ts and src/lib/student-profile.ts.
Logic is identical so unit tests pass with the same test vectors.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EligibilityCheck:
    key: str
    label: str
    passed: bool


def _normalize_token(value: str) -> str:
    """
    Degree and gender are free text on both sides, so punctuation and spacing
    differ constantly ("B.Tech", "b tech", "BTech"). Compare letters and digits
    only. Branch keeps its looser trim-and-uppercase rule: branch codes carry
    no punctuation, and widening that comparison would quietly make students
    eligible for jobs that currently exclude them.
    """
    return "".join(c for c in value.strip().upper() if c.isalnum())


def _unrestricted(allowed: list[str]) -> bool:
    """
    An empty list means the job places no restriction on this attribute, which
    is how every job created before these criteria were evaluated behaves. An
    explicit "all" or "any" means the same, because the form invites free text
    and administrators write it.
    """
    tokens = [t for t in (_normalize_token(a) for a in allowed) if t]
    return not tokens or any(t in {"ALL", "ANY"} for t in tokens)


def _matches_restriction(value: str | None, allowed: list[str]) -> bool:
    """
    A restriction the student's profile cannot answer fails. Leaving it open
    would let an unset field satisfy a criterion the placement cell set
    deliberately.
    """
    if _unrestricted(allowed):
        return True
    normalized = _normalize_token(value) if value else ""
    if not normalized:
        return False
    return normalized in {_normalize_token(a) for a in allowed}


def _meets_percent_floor(value: float | None, floor: float | None) -> bool:
    """
    An unset floor restricts nothing, the same convention every other
    optional criterion here follows. A set floor the student's profile
    cannot answer fails it, rather than silently passing an unset field.
    """
    if floor is None:
        return True
    return value is not None and value >= floor


def evaluate_eligibility(
    *,
    cgpa: float,
    batch: int,
    branch: str,
    degree: str | None,
    gender: str | None,
    backlogs: int,
    bans: int,
    documents_complete: bool,
    class10_percent: float | None = None,
    class12_percent: float | None = None,
    min_cgpa: float,
    job_batch: int,
    allowed_branches: list[str],
    allowed_degrees: list[str],
    allowed_genders: list[str],
    max_backlogs: int,
    max_bans: int = 0,
    min_10_percent: float | None = None,
    min_12_percent: float | None = None,
) -> list[EligibilityCheck]:
    return [
        EligibilityCheck(
            key="cgpa",
            label=f"CGPA {cgpa} >= {min_cgpa}",
            passed=cgpa >= min_cgpa,
        ),
        EligibilityCheck(
            key="class10Percent",
            label=(
                "10th percentage: no minimum"
                if min_10_percent is None
                else f"10th percentage {class10_percent if class10_percent is not None else 'not set'} >= {min_10_percent}"
            ),
            passed=_meets_percent_floor(class10_percent, min_10_percent),
        ),
        EligibilityCheck(
            key="class12Percent",
            label=(
                "12th percentage: no minimum"
                if min_12_percent is None
                else f"12th percentage {class12_percent if class12_percent is not None else 'not set'} >= {min_12_percent}"
            ),
            passed=_meets_percent_floor(class12_percent, min_12_percent),
        ),
        EligibilityCheck(
            key="batch",
            label=f"Batch {batch}",
            passed=batch == job_batch,
        ),
        EligibilityCheck(
            key="branch",
            label=f"Branch {branch}",
            passed=branch.strip().upper() in {b.strip().upper() for b in allowed_branches},
        ),
        EligibilityCheck(
            key="degree",
            label=(
                "Degree: open to all"
                if _unrestricted(allowed_degrees)
                else f"Degree {degree or 'not set'}"
            ),
            passed=_matches_restriction(degree, allowed_degrees),
        ),
        EligibilityCheck(
            key="gender",
            label=(
                "Open to all genders"
                if _unrestricted(allowed_genders)
                else f"Gender {gender or 'not set'}"
            ),
            passed=_matches_restriction(gender, allowed_genders),
        ),
        EligibilityCheck(
            key="backlogs",
            label=f"Backlogs {backlogs} <= {max_backlogs}",
            passed=backlogs <= max_backlogs,
        ),
        EligibilityCheck(
            key="bans",
            label=f"Bans {bans} <= {max_bans}",
            passed=bans <= max_bans,
        ),
        EligibilityCheck(
            key="documents",
            label="Profile documents complete",
            passed=documents_complete,
        ),
    ]


def is_eligible(checks: list[EligibilityCheck]) -> bool:
    return all(c.passed for c in checks)


# ---------------------------------------------------------------------------
# Profile completeness (mirrors src/lib/student-profile.ts)
# ---------------------------------------------------------------------------

_COMPLETION_FIELDS = [
    "name",
    "roll_number",
    "branch",
    "batch",
    "degree",
    "personal_email",
    "contact_number",
    "current_address",
    "class10_percent",
    "class12_percent",
    "cgpa",
]


def calculate_profile_completion(profile: dict) -> int:
    """
    Returns profile completion percentage (0-100).
    Profile dict keys should be snake_case matching _COMPLETION_FIELDS.
    """
    completed = sum(
        1
        for field in _COMPLETION_FIELDS
        if profile.get(field) not in (None, "", [])
    )
    return round((completed / len(_COMPLETION_FIELDS)) * 100)


def to_eligibility_profile(user, resume_count: int) -> dict | None:
    """
    Convert a User ORM object to an eligibility dict.
    Returns None if the profile is incomplete (missing cgpa/batch/branch).

    Degree and gender stay out of that guard: a job that does not restrict them
    must still be open to a student who has not filled them in.
    """
    if user.cgpa is None or user.batch is None or not user.branch:
        return None
    return {
        "cgpa": user.cgpa,
        "batch": user.batch,
        "branch": user.branch,
        "degree": user.degree,
        "gender": user.gender,
        "backlogs": user.backlogs,
        "bans": user.bans,
        "class10_percent": user.class10Percent,
        "class12_percent": user.class12Percent,
        "documents_complete": bool(
            user.aadhaarEncrypted and user.panCardEncrypted and resume_count > 0
        ),
    }
