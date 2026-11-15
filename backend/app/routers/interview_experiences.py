from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    PERM_INTERVIEW_EXPERIENCES_APPROVE,
    PERM_INTERVIEW_EXPERIENCES_DELETE,
    PERM_INTERVIEW_EXPERIENCES_VIEW,
    require_permission,
)
from app.dependencies import get_db, require_student
from app.models.db import InterviewExperience, InterviewExperienceStatus, Notification, User
from app.schemas.interview_experience import (
    BankCompanyDetailResponse,
    BankCompanyResponse,
    BankGroupResponse,
    AdminInterviewExperienceResponse,
    InterviewExperienceAuthorSummary,
    InterviewExperienceCreate,
    InterviewExperienceMetricsResponse,
    InterviewExperienceResponse,
    InterviewExperienceReviewRequest,
)
from app.services.email import send_notification_email
from app.services.interview_bank import build_groups, company_key, company_summaries, display_company

router = APIRouter(prefix="/interview-experiences", tags=["interview-experiences"])


def _to_admin_response(exp: InterviewExperience) -> AdminInterviewExperienceResponse:
    status_val = exp.status.value if hasattr(exp.status, "value") else str(exp.status)

    author_summary = None
    if exp.user:
        author_summary = InterviewExperienceAuthorSummary(
            id=exp.user.id,
            name=exp.user.name,
            email=exp.user.email,
            rollNumber=exp.user.rollNumber,
            branch=exp.user.branch,
            batch=exp.user.batch,
        )

    return AdminInterviewExperienceResponse(
        id=exp.id,
        userId=exp.userId,
        companyName=exp.companyName,
        role=exp.role,
        batch=exp.batch,
        interviewType=exp.interviewType,
        opportunityType=exp.opportunityType,
        difficulty=exp.difficulty,
        outcome=exp.outcome,
        dsaQuestions=exp.dsaQuestions,
        oopsQuestions=exp.oopsQuestions,
        dbmsQuestions=exp.dbmsQuestions,
        osQuestions=exp.osQuestions,
        cnQuestions=exp.cnQuestions,
        sqlQuestions=exp.sqlQuestions,
        systemDesignQuestions=exp.systemDesignQuestions,
        csFundamentalsQuestions=exp.csFundamentalsQuestions,
        resumeQuestions=exp.resumeQuestions,
        projectsDiscussed=exp.projectsDiscussed,
        codingQuestions=exp.codingQuestions,
        aptitudeQuestions=exp.aptitudeQuestions,
        hrQuestions=exp.hrQuestions,
        behavioralQuestions=exp.behavioralQuestions,
        resources=exp.resources,
        unansweredQuestions=exp.unansweredQuestions,
        tips=exp.tips,
        status=status_val,
        reviewNote=exp.reviewNote,
        reviewedById=exp.reviewedById,
        reviewedAt=exp.reviewedAt,
        createdAt=exp.createdAt,
        updatedAt=exp.updatedAt,
        author=author_summary,
    )


# ===========================================================================
# Student / community endpoints
# ===========================================================================

@router.get("", response_model=list[InterviewExperienceResponse])
async def list_approved_experiences(
    companyName: Optional[str] = Query(None, description="Filter by company name (partial match)"),
    batch: Optional[int] = Query(None, description="Filter by graduating batch year"),
    search: Optional[str] = Query(None, description="Search across company, role, and interview type"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """Browse approved interview experiences shared by other students."""
    stmt = (
        select(InterviewExperience)
        .where(InterviewExperience.status == InterviewExperienceStatus.APPROVED)
        .order_by(InterviewExperience.createdAt.desc())
    )

    if companyName:
        stmt = stmt.where(func.lower(InterviewExperience.companyName).like(f"%{companyName.strip().lower()}%"))

    if batch:
        stmt = stmt.where(InterviewExperience.batch == batch)

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(InterviewExperience.companyName).like(term),
                func.lower(InterviewExperience.role).like(term),
                func.lower(InterviewExperience.interviewType).like(term),
            )
        )

    stmt = stmt.offset(offset).limit(limit)
    result = await db.scalars(stmt)
    return result.all()


@router.get("/companies", response_model=list[str])
async def list_companies_with_experiences(
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """List distinct company names with at least one approved interview experience."""
    result = await db.scalars(
        select(distinct(InterviewExperience.companyName))
        .where(InterviewExperience.status == InterviewExperienceStatus.APPROVED)
        .order_by(InterviewExperience.companyName.asc())
    )
    return list(result.all())


def _approved():
    return select(InterviewExperience).where(
        InterviewExperience.status == InterviewExperienceStatus.APPROVED
    )


@router.get("/bank/companies", response_model=list[BankCompanyResponse])
async def question_bank_companies(
    search: Optional[str] = Query(None, description="Company name, matched word by word"),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Companies with approved experiences, merged across spellings, most-shared
    first. The question bank's landing list.
    """
    rows = (await db.scalars(_approved())).all()
    return company_summaries(rows, search=search)


@router.get("/bank", response_model=BankCompanyDetailResponse)
async def question_bank_company(
    company: str = Query(..., min_length=1, description="Company name; spelling and case are ignored"),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Every approved experience for one company, merged by role + opportunity
    type. Not paginated: one company holds tens of rows, and the bank is only
    useful when it is complete.
    """
    key = company_key(company)
    if not key:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a company name.")
    # Narrow in SQL on the first word, then match the exact key in Python.
    first_word = key.split(" ")[0]
    candidates = (
        await db.scalars(
            _approved().where(func.lower(InterviewExperience.companyName).like(f"%{first_word}%"))
        )
    ).all()
    rows = [row for row in candidates if company_key(row.companyName) == key]
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No experiences shared for this company yet.")

    groups = [
        BankGroupResponse(
            role=group.role,
            opportunityType=group.opportunityType,
            count=len(group.experiences),
            batches=group.batches,
            interviewTypes=group.interviewTypes,
            experiences=group.experiences,
        )
        for group in build_groups(rows)
    ]
    return BankCompanyDetailResponse(company=display_company(rows), total=len(rows), groups=groups)


@router.get("/mine", response_model=list[InterviewExperienceResponse])
async def list_my_experiences(
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """List all interview experiences submitted by the calling student, any status."""
    result = await db.scalars(
        select(InterviewExperience)
        .where(InterviewExperience.userId == user_payload["sub"])
        .order_by(InterviewExperience.createdAt.desc())
    )
    return result.all()


@router.post("", response_model=InterviewExperienceResponse)
async def submit_interview_experience(
    data: InterviewExperienceCreate,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """Submit a new interview experience for admin review before it is published."""
    now = datetime.now(timezone.utc)
    exp = InterviewExperience(
        id=str(uuid.uuid4()),
        userId=user_payload["sub"],
        updatedAt=now,
        companyName=data.companyName.strip(),
        role=data.role.strip(),
        batch=data.batch,
        interviewType=data.interviewType.strip(),
        opportunityType=data.opportunityType,
        difficulty=data.difficulty,
        outcome=data.outcome,
        dsaQuestions=data.dsaQuestions,
        oopsQuestions=data.oopsQuestions,
        dbmsQuestions=data.dbmsQuestions,
        osQuestions=data.osQuestions,
        cnQuestions=data.cnQuestions,
        sqlQuestions=data.sqlQuestions,
        systemDesignQuestions=data.systemDesignQuestions,
        csFundamentalsQuestions=data.csFundamentalsQuestions,
        resumeQuestions=data.resumeQuestions,
        projectsDiscussed=data.projectsDiscussed,
        codingQuestions=data.codingQuestions,
        aptitudeQuestions=data.aptitudeQuestions,
        hrQuestions=data.hrQuestions,
        behavioralQuestions=data.behavioralQuestions,
        resources=data.resources,
        unansweredQuestions=data.unansweredQuestions,
        tips=data.tips,
        status=InterviewExperienceStatus.PENDING,
    )
    db.add(exp)
    await db.commit()
    await db.refresh(exp)
    return exp


# ===========================================================================
# Administrative endpoints (interview_experiences.view / .approve / .delete)
#
# Registered before the generic "/{experience_id}" student route below so
# that literal paths like "/admin" are not swallowed by the single-segment
# dynamic route (FastAPI/Starlette match routes in registration order).
# ===========================================================================

@router.get("/admin/metrics", response_model=InterviewExperienceMetricsResponse)
async def get_experience_metrics(
    admin_payload: dict = Depends(require_permission(PERM_INTERVIEW_EXPERIENCES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve interview experience moderation metrics for the admin dashboard."""
    total = await db.scalar(select(func.count(InterviewExperience.id))) or 0
    pending = await db.scalar(
        select(func.count(InterviewExperience.id)).where(InterviewExperience.status == InterviewExperienceStatus.PENDING)
    ) or 0
    approved = await db.scalar(
        select(func.count(InterviewExperience.id)).where(InterviewExperience.status == InterviewExperienceStatus.APPROVED)
    ) or 0
    rejected = await db.scalar(
        select(func.count(InterviewExperience.id)).where(InterviewExperience.status == InterviewExperienceStatus.REJECTED)
    ) or 0

    return InterviewExperienceMetricsResponse(total=total, pending=pending, approved=approved, rejected=rejected)


@router.get("/admin", response_model=list[AdminInterviewExperienceResponse])
async def list_admin_experiences(
    status_filter: Optional[str] = Query(None, description="Filter by status (PENDING, APPROVED, REJECTED)"),
    search: Optional[str] = Query(None, description="Search across student name, roll number, company, and role"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin_payload: dict = Depends(require_permission(PERM_INTERVIEW_EXPERIENCES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """List all submitted interview experiences with filters, search, and author profile info."""
    stmt = (
        select(InterviewExperience)
        .options(selectinload(InterviewExperience.user))
        .order_by(InterviewExperience.createdAt.desc())
    )

    if status_filter:
        norm = status_filter.strip().upper()
        try:
            enum_status = InterviewExperienceStatus(norm)
            stmt = stmt.where(InterviewExperience.status == enum_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status_filter '{status_filter}'. Allowed: {[s.value for s in InterviewExperienceStatus]}",
            )

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.join(InterviewExperience.user).where(
            or_(
                func.lower(InterviewExperience.companyName).like(term),
                func.lower(InterviewExperience.role).like(term),
                func.lower(User.name).like(term),
                func.lower(User.email).like(term),
                func.lower(User.rollNumber).like(term),
            )
        )

    stmt = stmt.offset(offset).limit(limit)
    result = await db.scalars(stmt)
    records = result.all()

    return [_to_admin_response(exp) for exp in records]


@router.get("/admin/{experience_id}", response_model=AdminInterviewExperienceResponse)
async def get_admin_experience_detail(
    experience_id: str,
    admin_payload: dict = Depends(require_permission(PERM_INTERVIEW_EXPERIENCES_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve detailed information, including author profile, for a single submission."""
    stmt = (
        select(InterviewExperience)
        .options(selectinload(InterviewExperience.user))
        .where(InterviewExperience.id == experience_id)
    )
    exp = await db.scalar(stmt)
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview experience not found.")

    return _to_admin_response(exp)


@router.post("/admin/{experience_id}/approve", response_model=AdminInterviewExperienceResponse)
async def approve_experience(
    experience_id: str,
    data: InterviewExperienceReviewRequest,
    background_tasks: BackgroundTasks,
    admin_payload: dict = Depends(require_permission(PERM_INTERVIEW_EXPERIENCES_APPROVE)),
    db: AsyncSession = Depends(get_db),
):
    """Approve a submission so it becomes visible to all students, and notify the author."""
    stmt = (
        select(InterviewExperience)
        .options(selectinload(InterviewExperience.user))
        .where(InterviewExperience.id == experience_id)
    )
    exp = await db.scalar(stmt)
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview experience not found.")

    exp.status = InterviewExperienceStatus.APPROVED
    exp.reviewNote = data.reviewNote.strip() if data.reviewNote else None
    exp.reviewedById = admin_payload["sub"]
    exp.reviewedAt = datetime.now(timezone.utc)
    exp.updatedAt = datetime.now(timezone.utc)

    notif = Notification(
        id=str(uuid.uuid4()),
        userId=exp.userId,
        title="Interview experience published",
        message=f"Your interview experience for {exp.companyName} is now live for other students.",
        link="/interview-experiences",
    )
    db.add(notif)
    await db.commit()
    await db.refresh(exp)

    if exp.user and exp.user.email:
        background_tasks.add_task(
            send_notification_email,
            to_email=exp.user.email,
            subject=f"Interview Experience Published: {exp.companyName}",
            message=(
                f"Hello {exp.user.name or 'Student'},\n\n"
                f"Thank you for sharing your interview experience for {exp.companyName} ({exp.role}). "
                f"It has been approved and is now visible to other students on the portal.\n\n"
                f"Keep contributing to help fellow students prepare!"
            ),
        )

    return _to_admin_response(exp)


@router.post("/admin/{experience_id}/reject", response_model=AdminInterviewExperienceResponse)
async def reject_experience(
    experience_id: str,
    data: InterviewExperienceReviewRequest,
    background_tasks: BackgroundTasks,
    admin_payload: dict = Depends(require_permission(PERM_INTERVIEW_EXPERIENCES_APPROVE)),
    db: AsyncSession = Depends(get_db),
):
    """Reject a submission with an optional note, and notify the author."""
    stmt = (
        select(InterviewExperience)
        .options(selectinload(InterviewExperience.user))
        .where(InterviewExperience.id == experience_id)
    )
    exp = await db.scalar(stmt)
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview experience not found.")

    exp.status = InterviewExperienceStatus.REJECTED
    exp.reviewNote = data.reviewNote.strip() if data.reviewNote else None
    exp.reviewedById = admin_payload["sub"]
    exp.reviewedAt = datetime.now(timezone.utc)
    exp.updatedAt = datetime.now(timezone.utc)

    reason_text = f" Note: {exp.reviewNote}" if exp.reviewNote else ""

    notif = Notification(
        id=str(uuid.uuid4()),
        userId=exp.userId,
        title="Interview experience not published",
        message=f"Your interview experience for {exp.companyName} was not approved.{reason_text}",
        link="/interview-experiences",
    )
    db.add(notif)
    await db.commit()
    await db.refresh(exp)

    if exp.user and exp.user.email:
        background_tasks.add_task(
            send_notification_email,
            to_email=exp.user.email,
            subject=f"Interview Experience Update: {exp.companyName}",
            message=(
                f"Hello {exp.user.name or 'Student'},\n\n"
                f"Your submitted interview experience for {exp.companyName} ({exp.role}) was reviewed "
                f"and not approved for publishing.\n\n"
                f"{'Note: ' + exp.reviewNote if exp.reviewNote else ''}\n\n"
                f"Please contact the Placement Cell if you have any questions."
            ),
        )

    return _to_admin_response(exp)


@router.delete("/admin/{experience_id}")
async def delete_experience(
    experience_id: str,
    admin_payload: dict = Depends(require_permission(PERM_INTERVIEW_EXPERIENCES_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Permanently remove an interview experience submission."""
    exp = await db.scalar(select(InterviewExperience).where(InterviewExperience.id == experience_id))
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview experience not found.")

    await db.delete(exp)
    await db.commit()
    return {"message": "Interview experience deleted successfully."}


# ===========================================================================
# Generic student detail route — must stay last (see note above)
# ===========================================================================

@router.get("/{experience_id}", response_model=InterviewExperienceResponse)
async def get_experience_detail(
    experience_id: str,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single approved experience, or the caller's own submission of any status."""
    exp = await db.scalar(select(InterviewExperience).where(InterviewExperience.id == experience_id))
    if not exp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview experience not found.")

    is_owner = exp.userId == user_payload["sub"]
    if exp.status != InterviewExperienceStatus.APPROVED and not is_owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview experience not found.")

    return exp
