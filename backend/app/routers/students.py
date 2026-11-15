from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import PERM_STUDENTS_UPDATE, PERM_STUDENTS_VIEW, require_permission
from app.dependencies import get_db
from app.models.db import Application, JobProfile, JobStatus, Offer, Resume, Role, User
from app.schemas.student import (
    MissedCompanyFlag,
    StudentAcademicCorrection,
    StudentAcademicResponse,
    StudentApplicationFlag,
)
from app.services.eligibility import to_eligibility_profile
from app.services.placement_policy import (
    Standing,
    StandingResult,
    placement_standing,
    policy_allows,
    policy_job_from_row,
    policy_offer_from_row,
)
from app.services.student_flags import compute_missed_streak

router = APIRouter(prefix="/students", tags=["students"])


@router.patch("/admin/{student_id}/academic", response_model=StudentAcademicResponse)
async def update_student_academic_record(
    student_id: str,
    data: StudentAcademicCorrection,
    admin_payload: dict = Depends(require_permission(PERM_STUDENTS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """
    The placement team's way to correct a student's cgpa/backlogs — the
    same two columns a student can already set on their own profile via
    PATCH /profile (see the 2026-09-23 decision and the comment on
    StudentProfileUpdate). Not the only writer, just the one an
    administrator uses on someone else's behalf.
    """
    student = await db.scalar(select(User).where(User.id == student_id, User.role == Role.STUDENT))
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(student, key, value)

    await db.commit()
    await db.refresh(student)
    return student


async def _standings(db: AsyncSession) -> dict[str, StandingResult]:
    """Every student's placement-policy standing, keyed by user id."""
    offers = (
        await db.scalars(
            select(Offer).options(selectinload(Offer.company), selectinload(Offer.user))
        )
    ).all()
    by_student: dict[str, list] = {}
    degrees: dict[str, str | None] = {}
    for offer in offers:
        by_student.setdefault(offer.userId, []).append(policy_offer_from_row(offer))
        degrees[offer.userId] = offer.user.degree if offer.user else None
    return {
        user_id: placement_standing(items, degrees.get(user_id))
        for user_id, items in by_student.items()
    }


@router.get("/admin/standings")
async def list_student_standings(
    admin_payload: dict = Depends(require_permission(PERM_STUDENTS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """
    Placement-policy standing of every student holding at least one offer.
    A student missing from the list is OPEN.
    """
    return [
        {
            "userId": user_id,
            "standing": result.standing.value,
            "label": result.label,
            "companyName": result.company_name,
            "ctc": result.ctc,
        }
        for user_id, result in (await _standings(db)).items()
        if result.standing != Standing.OPEN
    ]


@router.get("/admin/flags", response_model=list[StudentApplicationFlag])
async def list_students_with_missed_streaks(
    min_streak: int = Query(
        3, ge=2, le=20, description="Minimum consecutive missed-but-eligible companies to flag a student"
    ),
    admin_payload: dict = Depends(require_permission(PERM_STUDENTS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """
    Flags students who were eligible for `min_streak` or more companies' drives
    in a row (chronologically, by registration deadline) without applying to
    any of them. Draft job profiles are excluded — students were never shown those.
    """
    students = (await db.scalars(select(User).where(User.role == Role.STUDENT))).all()
    if not students:
        return []

    resume_count_rows = await db.execute(select(Resume.userId, func.count(Resume.id)).group_by(Resume.userId))
    resume_counts = {row[0]: row[1] for row in resume_count_rows.all()}

    jobs = (
        await db.scalars(
            select(JobProfile)
            .options(selectinload(JobProfile.company))
            .where(JobProfile.status != JobStatus.DRAFT)
            .order_by(JobProfile.registrationDeadline.asc())
        )
    ).all()
    jobs_in_order = [
        {
            "id": job.id,
            "companyId": job.companyId,
            "companyName": job.company.name if job.company else "Unknown company",
            "title": job.title,
            "minCGPA": job.minCGPA,
            "min10Percent": job.min10Percent,
            "min12Percent": job.min12Percent,
            "batch": job.batch,
            "allowedBranches": job.allowedBranches,
            "allowedDegrees": job.allowedDegrees,
            "allowedGenders": job.allowedGenders,
            "maxBacklogs": job.maxBacklogs,
            "maxBans": job.maxBans,
            "registrationDeadline": job.registrationDeadline,
        }
        for job in jobs
    ]

    # The policy decides which drives a student could have applied to: a
    # placed student skipping drives they are barred from has missed nothing.
    policy_jobs = {job.id: policy_job_from_row(job) for job in jobs}
    standings = await _standings(db)

    application_rows = await db.execute(select(Application.userId, Application.jobProfileId))
    applied_by_student: dict[str, set[str]] = {}
    for user_id, job_profile_id in application_rows.all():
        applied_by_student.setdefault(user_id, set()).add(job_profile_id)

    results: list[StudentApplicationFlag] = []

    for student in students:
        profile = to_eligibility_profile(student, resume_counts.get(student.id, 0))
        if not profile:
            continue

        standing = standings.get(student.id)
        open_jobs = (
            jobs_in_order
            if standing is None or standing.standing == Standing.OPEN
            else [j for j in jobs_in_order if policy_allows(standing, policy_jobs[j["id"]])[0]]
        )

        streak = compute_missed_streak(
            profile=profile,
            jobs_in_chronological_order=open_jobs,
            applied_job_ids=applied_by_student.get(student.id, set()),
        )

        if streak.longest_missed_streak < min_streak:
            continue

        results.append(
            StudentApplicationFlag(
                userId=student.id,
                name=student.name,
                email=student.email,
                rollNumber=student.rollNumber,
                branch=student.branch,
                batch=student.batch,
                longestMissedStreak=streak.longest_missed_streak,
                totalEligibleCompanies=streak.total_eligible_companies,
                totalAppliedCompanies=streak.total_applied_companies,
                missedCompanies=[
                    MissedCompanyFlag(
                        companyId=c.company_id,
                        companyName=c.company_name,
                        jobTitle=c.job_title,
                        registrationDeadline=c.registration_deadline,
                    )
                    for c in streak.streak_companies
                ],
            )
        )

    results.sort(key=lambda r: r.longestMissedStreak, reverse=True)
    return results
