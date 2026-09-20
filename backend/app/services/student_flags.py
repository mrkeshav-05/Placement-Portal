"""
Detects students who were eligible for several companies' drives in a row
(chronologically, by registration deadline) without applying to any of them.

Pure, DB-free logic so it can be unit tested directly; the router
(`app/routers/students.py`) is responsible for loading the SQLAlchemy rows
and shaping them into the plain dicts this module expects.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.services.eligibility import evaluate_eligibility, is_eligible


@dataclass
class MissedCompany:
    company_id: str
    company_name: str
    job_title: str
    registration_deadline: datetime


@dataclass
class MissedStreakResult:
    longest_missed_streak: int
    total_eligible_companies: int
    total_applied_companies: int
    streak_companies: list[MissedCompany]


def compute_missed_streak(
    *,
    profile: dict[str, Any],
    jobs_in_chronological_order: list[dict[str, Any]],
    applied_job_ids: set[str],
) -> MissedStreakResult:
    """
    `jobs_in_chronological_order` entries need: id, companyId, companyName, title,
    minCGPA, batch, allowedBranches, allowedDegrees, allowedGenders, maxBacklogs,
    maxBans, registrationDeadline.

    Companies are deduplicated by first eligible appearance in the given order.
    A company counts as "applied" if the student applied to any job profile at
    that company. Returns the longest run of consecutive eligible-but-unapplied
    companies, in chronological order.
    """
    company_order: list[str] = []
    company_meta: dict[str, dict[str, Any]] = {}

    for job in jobs_in_chronological_order:
        checks = evaluate_eligibility(
            cgpa=profile["cgpa"],
            batch=profile["batch"],
            branch=profile["branch"],
            degree=profile["degree"],
            gender=profile["gender"],
            backlogs=profile["backlogs"],
            bans=profile["bans"],
            documents_complete=profile["documents_complete"],
            class10_percent=profile["class10_percent"],
            class12_percent=profile["class12_percent"],
            min_cgpa=job["minCGPA"],
            job_batch=job["batch"],
            allowed_branches=job["allowedBranches"],
            allowed_degrees=job["allowedDegrees"],
            allowed_genders=job["allowedGenders"],
            max_backlogs=job["maxBacklogs"],
            max_bans=job.get("maxBans", 0),
            min_10_percent=job.get("min10Percent"),
            min_12_percent=job.get("min12Percent"),
        )
        if not is_eligible(checks):
            continue

        company_id = job["companyId"]
        if company_id not in company_meta:
            company_order.append(company_id)
            company_meta[company_id] = {
                "companyName": job["companyName"],
                "jobTitle": job["title"],
                "registrationDeadline": job["registrationDeadline"],
                "applied": False,
            }
        if job["id"] in applied_job_ids:
            company_meta[company_id]["applied"] = True

    best_run: list[str] = []
    current_run: list[str] = []
    for company_id in company_order:
        if not company_meta[company_id]["applied"]:
            current_run.append(company_id)
            if len(current_run) > len(best_run):
                best_run = list(current_run)
        else:
            current_run = []

    streak_companies = [
        MissedCompany(
            company_id=cid,
            company_name=company_meta[cid]["companyName"],
            job_title=company_meta[cid]["jobTitle"],
            registration_deadline=company_meta[cid]["registrationDeadline"],
        )
        for cid in best_run
    ]

    return MissedStreakResult(
        longest_missed_streak=len(best_run),
        total_eligible_companies=len(company_order),
        total_applied_companies=sum(1 for c in company_order if company_meta[c]["applied"]),
        streak_companies=streak_companies,
    )
