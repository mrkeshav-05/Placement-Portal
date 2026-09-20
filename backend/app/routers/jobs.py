from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from app.core import cache
from app.dependencies import get_db, require_student
from app.models.db import JobProfile, JobStatus, User, Resume
from app.schemas.job import JobResponse
from app.services.eligibility import evaluate_eligibility, is_eligible

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("", response_model=list[JobResponse])
async def list_jobs(
    active_only: bool = Query(
        False,
        alias="activeOnly",
        description="Return only ACTIVE drives, omitting ones that have ended.",
    ),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    """
    Drives a student may see: ACTIVE and ENDED, never DRAFT.

    Ordered by deadline so the soonest comes first, which is the order both
    student screens display and the order the dashboard's "next deadline"
    depends on.

    Cached. The result is the same for every student — eligibility is worked
    out per viewer, but from the same rows — so there is no viewer in the key.
    Note the absence of a "closes after now" filter: that would put the clock
    in the cache key and expire an entry a second after writing it. Callers
    that want upcoming drives filter the deadline themselves.
    """
    async def load() -> list[dict]:
        stmt = (
            select(JobProfile)
            .options(selectinload(JobProfile.company))
            .order_by(JobProfile.registrationDeadline.asc())
        )
        if active_only:
            stmt = stmt.where(JobProfile.status == JobStatus.ACTIVE)
        else:
            stmt = stmt.where(JobProfile.status != JobStatus.DRAFT)

        jobs = (await db.scalars(stmt)).all()
        return [JobResponse.model_validate(job).model_dump(mode="json") for job in jobs]

    return await cache.get_or_set(
        cache.TOPIC_EVENTS,
        {"view": "list", "activeOnly": active_only},
        load,
    )

@router.get("/{job_id}")
async def get_job_detail(
    job_id: str,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db)
):
    """
    One drive, with this student's eligibility worked out against it.

    Only the drive is cached. Eligibility depends on the viewer's CGPA,
    branch, backlogs and resume count, so it is computed on every request
    from the caller's own row — caching it would hand one student another's
    verdict.
    """
    async def load() -> dict | None:
        found = await db.scalar(
            select(JobProfile)
            .options(selectinload(JobProfile.company))
            .where(JobProfile.id == job_id)
        )
        if not found:
            return None
        return JobResponse.model_validate(found).model_dump(mode="json")

    job = await cache.get_or_set(
        cache.TOPIC_EVENTS,
        {"view": "detail", "id": job_id},
        load,
    )
    if not job or job["status"] == JobStatus.DRAFT.value:
        raise HTTPException(status_code=404, detail="Job not found")

    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    resumes_count = await db.scalar(select(func.count(Resume.id)).where(Resume.userId == user.id))
    
    # Calculate eligibility
    from app.services.eligibility import to_eligibility_profile
    profile = to_eligibility_profile(user, resumes_count or 0)
    
    eligibility_checks = []
    eligible = False
    
    if profile:
        eligibility_checks = evaluate_eligibility(
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
            max_bans=job["maxBans"],
            min_10_percent=job.get("min10Percent"),
            min_12_percent=job.get("min12Percent"),
        )
        eligible = is_eligible(eligibility_checks)

    return {
        "job": job,
        "eligibility": {
            "checks": eligibility_checks,
            "eligible": eligible,
            "profile_complete": bool(profile)
        }
    }
