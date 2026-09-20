"""Tests for the missed-eligible-companies streak detector used to flag students."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.services.student_flags import compute_missed_streak

BASE_PROFILE = {
    "cgpa": 8.5,
    "batch": 2026,
    "branch": "CS",
    "degree": "B.Tech",
    "gender": "Male",
    "backlogs": 0,
    "bans": 0,
    "documents_complete": True,
    "class10_percent": 85.0,
    "class12_percent": 80.0,
}


def _job(
    job_id: str,
    company_id: str,
    company_name: str,
    days_offset: int,
    *,
    min_cgpa: float = 6.0,
    batch: int = 2026,
    allowed_branches: list[str] | None = None,
    allowed_degrees: list[str] | None = None,
    allowed_genders: list[str] | None = None,
    max_backlogs: int = 5,
    max_bans: int = 0,
):
    return {
        "id": job_id,
        "companyId": company_id,
        "companyName": company_name,
        "title": "SDE",
        "minCGPA": min_cgpa,
        "batch": batch,
        "allowedBranches": allowed_branches or ["CS"],
        "allowedDegrees": allowed_degrees or [],
        "allowedGenders": allowed_genders or [],
        "maxBacklogs": max_backlogs,
        "maxBans": max_bans,
        "registrationDeadline": datetime(2026, 1, 1) + timedelta(days=days_offset),
    }


def test_flags_a_streak_of_fully_missed_eligible_companies():
    jobs = [
        _job("j1", "c1", "Alpha", 0),
        _job("j2", "c2", "Beta", 1),
        _job("j3", "c3", "Gamma", 2),
        _job("j4", "c4", "Delta", 3),
    ]
    result = compute_missed_streak(profile=BASE_PROFILE, jobs_in_chronological_order=jobs, applied_job_ids=set())

    assert result.longest_missed_streak == 4
    assert result.total_eligible_companies == 4
    assert result.total_applied_companies == 0
    assert [c.company_name for c in result.streak_companies] == ["Alpha", "Beta", "Gamma", "Delta"]


def test_an_application_breaks_the_streak_into_shorter_runs():
    jobs = [
        _job("j1", "c1", "Alpha", 0),
        _job("j2", "c2", "Beta", 1),
        _job("j3", "c3", "Gamma", 2),  # applied here
        _job("j4", "c4", "Delta", 3),
        _job("j5", "c5", "Epsilon", 4),
    ]
    result = compute_missed_streak(
        profile=BASE_PROFILE, jobs_in_chronological_order=jobs, applied_job_ids={"j3"}
    )

    # Runs are [Alpha, Beta] (len 2) and [Delta, Epsilon] (len 2); longest is 2, not 3.
    assert result.longest_missed_streak == 2
    assert result.total_eligible_companies == 5
    assert result.total_applied_companies == 1
    assert [c.company_name for c in result.streak_companies] == ["Alpha", "Beta"]


def test_ineligible_jobs_are_skipped_entirely_not_counted_as_missed():
    jobs = [
        _job("j1", "c1", "Alpha", 0),
        _job("j2", "c2", "Beta", 1, min_cgpa=9.5),  # student's CGPA (8.5) fails this one
        _job("j3", "c3", "Gamma", 2),
        _job("j4", "c4", "Delta", 3),
    ]
    result = compute_missed_streak(profile=BASE_PROFILE, jobs_in_chronological_order=jobs, applied_job_ids=set())

    assert result.total_eligible_companies == 3
    assert result.longest_missed_streak == 3
    assert [c.company_name for c in result.streak_companies] == ["Alpha", "Gamma", "Delta"]


def test_multiple_job_profiles_at_the_same_company_collapse_into_one_entry():
    jobs = [
        _job("j1", "c1", "Alpha", 0),
        _job("j2", "c1", "Alpha", 1),  # second role at the same company, applied to this one
        _job("j3", "c2", "Beta", 2),
    ]
    result = compute_missed_streak(profile=BASE_PROFILE, jobs_in_chronological_order=jobs, applied_job_ids={"j2"})

    assert result.total_eligible_companies == 2
    assert result.total_applied_companies == 1
    assert result.longest_missed_streak == 1
    assert [c.company_name for c in result.streak_companies] == ["Beta"]


def test_applying_to_everything_yields_no_missed_streak():
    jobs = [_job("j1", "c1", "Alpha", 0), _job("j2", "c2", "Beta", 1)]
    result = compute_missed_streak(
        profile=BASE_PROFILE, jobs_in_chronological_order=jobs, applied_job_ids={"j1", "j2"}
    )

    assert result.longest_missed_streak == 0
    assert result.streak_companies == []


def test_no_eligible_companies_at_all():
    jobs = [_job("j1", "c1", "Alpha", 0, allowed_branches=["ECE"])]
    result = compute_missed_streak(profile=BASE_PROFILE, jobs_in_chronological_order=jobs, applied_job_ids=set())

    assert result.total_eligible_companies == 0
    assert result.longest_missed_streak == 0
