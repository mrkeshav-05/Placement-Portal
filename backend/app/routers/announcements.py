from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    PERM_ANNOUNCEMENTS_CREATE,
    PERM_ANNOUNCEMENTS_DELETE,
    PERM_ANNOUNCEMENTS_UPDATE,
    PERM_ANNOUNCEMENTS_VIEW,
    get_current_user,
    has_permission,
    require_permission,
)
from app.core.storage import delete_file
from app.dependencies import get_db
from app.models.db import (
    Announcement,
    AnnouncementAttachment,
    AnnouncementCategory,
    AnnouncementStatus,
    Company,
    JobProfile,
    User,
)
from app.schemas.announcement import (
    AnnouncementAuthorSummary,
    AnnouncementCompanySummary,
    AnnouncementCreate,
    AnnouncementAttachmentInput,
    AnnouncementAttachmentResponse,
    AnnouncementResponse,
    AnnouncementUpdate,
)

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _to_announcement_response(a: Announcement) -> AnnouncementResponse:
    category_val = a.category.value if hasattr(a.category, "value") else str(a.category)
    company_summary = None
    if a.company:
        company_summary = AnnouncementCompanySummary(
            id=a.company.id,
            name=a.company.name,
            logoUrl=a.company.logoUrl,
            website=a.company.website,
        )

    creator_name = a.created_by.name if a.created_by else None
    creator_email = a.created_by.email if a.created_by else None

    status_val = a.status.value if hasattr(a.status, "value") else str(a.status)

    return AnnouncementResponse(
        id=a.id,
        title=a.title,
        content=a.content,
        category=category_val,
        status=status_val,
        publishedAt=a.publishedAt,
        tags=a.tags or [],
        companyId=a.companyId,
        jobProfileId=a.jobProfileId,
        jobTitle=a.job_profile.title if a.job_profile else None,
        company=company_summary,
        createdAt=a.createdAt,
        createdById=a.createdById,
        createdByName=creator_name,
        createdByEmail=creator_email,
        attachments=[
            AnnouncementAttachmentResponse.model_validate(attachment)
            for attachment in sorted(a.attachments, key=lambda item: item.uploadedAt)
        ],
    )


def _parse_category(category_input: str) -> AnnouncementCategory:
    normalized = category_input.strip().upper().replace(" ", "_")
    try:
        return AnnouncementCategory(normalized)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category '{category_input}'. Allowed: {[c.value for c in AnnouncementCategory]}",
        )


def _parse_status(status_input: str) -> AnnouncementStatus:
    normalized = status_input.strip().upper()
    try:
        return AnnouncementStatus(normalized)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_input}'. Allowed: {[s.value for s in AnnouncementStatus]}",
        )


def _attachment_row(announcement_id: str, data: AnnouncementAttachmentInput) -> AnnouncementAttachment:
    return AnnouncementAttachment(
        id=f"cuid_{uuid.uuid4().hex[:20]}",
        announcementId=announcement_id,
        fileName=data.fileName.strip(),
        fileUrl=data.fileUrl.strip(),
        mimeType=data.mimeType.strip(),
        sizeBytes=data.sizeBytes,
        uploadedAt=datetime.now(timezone.utc),
    )


def _may_see_drafts(caller: dict) -> bool:
    """A draft belongs to the placement cell until it is published."""
    return has_permission(caller, PERM_ANNOUNCEMENTS_VIEW)


@router.get("", response_model=list[AnnouncementResponse])
async def list_announcements(
    category: Optional[str] = Query(None, description="Filter by category (COMPANY_EVENT, GENERAL)"),
    status_filter: Optional[str] = Query(
        None, alias="status", description="Filter by status (DRAFT, PUBLISHED). Managers only."
    ),
    company_id: Optional[str] = Query(None, description="Filter by associated company ID"),
    search: Optional[str] = Query(None, description="Search across title, content, and tags"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    caller: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List announcements with optional filters. Accessible to all authenticated
    users; students only ever receive published rows.
    """
    stmt = (
        select(Announcement)
        .options(
            selectinload(Announcement.company),
            selectinload(Announcement.job_profile),
            selectinload(Announcement.created_by),
            selectinload(Announcement.attachments),
        )
        .order_by(Announcement.createdAt.desc())
    )

    if _may_see_drafts(caller):
        if status_filter:
            stmt = stmt.where(Announcement.status == _parse_status(status_filter))
    else:
        # The filter is ignored rather than rejected: a student asking for
        # drafts is asking for rows that are not theirs to see.
        stmt = stmt.where(Announcement.status == AnnouncementStatus.PUBLISHED)

    if category:
        cat_enum = _parse_category(category)
        stmt = stmt.where(Announcement.category == cat_enum)

    if company_id:
        stmt = stmt.where(Announcement.companyId == company_id)

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Announcement.title).like(term),
                func.lower(Announcement.content).like(term),
                func.lower(func.array_to_string(Announcement.tags, " ")).like(term),
            )
        )

    stmt = stmt.offset(offset).limit(limit)
    announcements = (await db.scalars(stmt)).all()
    return [_to_announcement_response(a) for a in announcements]


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: str,
    caller: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a single announcement by ID.
    """
    stmt = (
        select(Announcement)
        .options(
            selectinload(Announcement.company),
            selectinload(Announcement.job_profile),
            selectinload(Announcement.created_by),
            selectinload(Announcement.attachments),
        )
        .where(Announcement.id == announcement_id)
    )
    announcement = await db.scalar(stmt)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )
    if announcement.status == AnnouncementStatus.DRAFT and not _may_see_drafts(caller):
        # Same 404 as a missing row: a draft's existence is not public either.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )
    return _to_announcement_response(announcement)


@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    data: AnnouncementCreate,
    caller: dict = Depends(require_permission(PERM_ANNOUNCEMENTS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new announcement. Requires 'announcements:manage' permission.
    """
    cat_enum = _parse_category(data.category)

    # Validate company if provided
    clean_company_id = data.companyId.strip() if data.companyId else None
    if cat_enum == AnnouncementCategory.GENERAL:
        clean_company_id = None
    elif clean_company_id:
        company = await db.scalar(select(Company).where(Company.id == clean_company_id))
        if not company:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Company with ID '{clean_company_id}' does not exist.",
            )

    # Resolve author
    caller_sub = caller.get("sub") or caller.get("id")
    author = None
    if caller_sub:
        author = await db.scalar(select(User).where(User.id == caller_sub))
    if not author and caller.get("email"):
        author = await db.scalar(select(User).where(User.email == caller["email"].strip().lower()))

    if not author:
        caller_email = (caller.get("email") or "").strip().lower()
        if not caller_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user profile not found.",
            )
        author_id = caller_sub or f"cuid_{uuid.uuid4().hex[:20]}"
        author = User(
            id=author_id,
            email=caller_email,
            name=caller.get("name"),
            role=caller.get("role", "PLACEMENT_TEAM"),
            updatedAt=datetime.now(timezone.utc),
        )
        db.add(author)
        await db.flush()
    else:
        author_id = author.id

    # Clean tags
    clean_tags = [t.strip() for t in data.tags if t and t.strip()]

    # A general notice is not about a drive, so it never carries one.
    clean_job_id = data.jobProfileId if cat_enum == AnnouncementCategory.COMPANY_EVENT else None
    if clean_job_id:
        job = await db.scalar(select(JobProfile).where(JobProfile.id == clean_job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job profile with ID '{clean_job_id}' does not exist.",
            )

    announcement_id = f"cuid_{uuid.uuid4().hex[:20]}"
    status_enum = _parse_status(data.status)
    new_announcement = Announcement(
        id=announcement_id,
        title=data.title.strip(),
        content=data.content.strip(),
        category=cat_enum,
        status=status_enum,
        publishedAt=(
            datetime.now(timezone.utc) if status_enum == AnnouncementStatus.PUBLISHED else None
        ),
        tags=clean_tags,
        companyId=clean_company_id,
        jobProfileId=clean_job_id,
        createdById=author_id,
    )

    db.add(new_announcement)
    for attachment in data.attachments:
        db.add(_attachment_row(announcement_id, attachment))
    await db.commit()

    # Re-fetch with relations for proper response serialization
    stmt = (
        select(Announcement)
        .options(
            selectinload(Announcement.company),
            selectinload(Announcement.job_profile),
            selectinload(Announcement.created_by),
            selectinload(Announcement.attachments),
        )
        .where(Announcement.id == announcement_id)
    )
    saved = await db.scalar(stmt)
    return _to_announcement_response(saved)


@router.patch("/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: str,
    data: AnnouncementUpdate,
    caller: dict = Depends(require_permission(PERM_ANNOUNCEMENTS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    """
    Update an existing announcement. Requires 'announcements:manage' permission.
    """
    stmt = (
        select(Announcement)
        .options(
            selectinload(Announcement.company),
            selectinload(Announcement.job_profile),
            selectinload(Announcement.created_by),
            selectinload(Announcement.attachments),
        )
        .where(Announcement.id == announcement_id)
    )
    announcement = await db.scalar(stmt)
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    if data.title is not None:
        announcement.title = data.title.strip()

    if data.content is not None:
        announcement.content = data.content.strip()

    if data.category is not None:
        announcement.category = _parse_category(data.category)
        if announcement.category == AnnouncementCategory.GENERAL:
            announcement.companyId = None
            announcement.jobProfileId = None

    if data.tags is not None:
        announcement.tags = [t.strip() for t in data.tags if t and t.strip()]

    if "jobProfileId" in data.model_fields_set:
        if announcement.category == AnnouncementCategory.GENERAL:
            announcement.jobProfileId = None
        elif data.jobProfileId:
            job = await db.scalar(select(JobProfile).where(JobProfile.id == data.jobProfileId))
            if not job:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Job profile with ID '{data.jobProfileId}' does not exist.",
                )
            announcement.jobProfileId = data.jobProfileId
        else:
            announcement.jobProfileId = None

    if data.status is not None:
        new_status = _parse_status(data.status)
        # `publishedAt` records the first time students could see it, so
        # re-publishing a withdrawn announcement keeps the original date.
        if new_status == AnnouncementStatus.PUBLISHED and announcement.publishedAt is None:
            announcement.publishedAt = datetime.now(timezone.utc)
        announcement.status = new_status

    # If companyId was explicitly supplied in request
    if "companyId" in data.model_fields_set:
        clean_company_id = data.companyId.strip() if data.companyId else None
        if announcement.category == AnnouncementCategory.GENERAL:
            announcement.companyId = None
        elif clean_company_id:
            company = await db.scalar(select(Company).where(Company.id == clean_company_id))
            if not company:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Company with ID '{clean_company_id}' does not exist.",
                )
            announcement.companyId = clean_company_id
        else:
            announcement.companyId = None

    if data.attachments is not None:
        # The list arrives whole. Files dropped from it are deleted from
        # storage too, otherwise removing an attachment only hides it.
        keep = {item.fileUrl.strip() for item in data.attachments}
        existing = (
            await db.scalars(
                select(AnnouncementAttachment).where(
                    AnnouncementAttachment.announcementId == announcement.id
                )
            )
        ).all()
        for row in existing:
            if row.fileUrl in keep:
                continue
            delete_file(row.fileUrl)
            await db.delete(row)
        known = {row.fileUrl for row in existing}
        for item in data.attachments:
            if item.fileUrl.strip() not in known:
                db.add(_attachment_row(announcement.id, item))

    await db.commit()

    # Re-fetch with relations
    saved = await db.scalar(stmt)
    return _to_announcement_response(saved)


@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    caller: dict = Depends(require_permission(PERM_ANNOUNCEMENTS_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete an announcement. Requires 'announcements:manage' permission.
    """
    announcement = await db.scalar(
        select(Announcement)
        .options(selectinload(Announcement.attachments))
        .where(Announcement.id == announcement_id)
    )
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found.",
        )

    # The rows cascade; the stored files do not.
    for attachment in announcement.attachments:
        delete_file(attachment.fileUrl)

    await db.delete(announcement)
    await db.commit()
    return {"success": True, "message": "Announcement deleted successfully."}

