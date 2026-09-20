from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import PERM_STUDENTS_VIEW, require_permission
from app.dependencies import get_db
from app.models.db import Application, JobProfile, JobStatus, Resume, Role, User
from app.schemas.student import MissedCompanyFlag, StudentApplicationFlag
from app.services.eligibility import to_eligibility_profile
from app.services.student_flags import compute_missed_streak

router = APIRouter(prefix="/students", tags=["students"])


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

    application_rows = await db.execute(select(Application.userId, Application.jobProfileId))
    applied_by_student: dict[str, set[str]] = {}
    for user_id, job_profile_id in application_rows.all():
        applied_by_student.setdefault(user_id, set()).add(job_profile_id)

    results: list[StudentApplicationFlag] = []

    for student in students:
        profile = to_eligibility_profile(student, resume_counts.get(student.id, 0))
        if not profile:
            continue

        streak = compute_missed_streak(
            profile=profile,
            jobs_in_chronological_order=jobs_in_order,
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
