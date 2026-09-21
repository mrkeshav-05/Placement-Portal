"""
Resume upload endpoints.

POST /uploads/resume  — student uploads their own PDF resume
POST /uploads/admin/noc-document — admin uploads a NOC PDF
"""
from __future__ import annotations

import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import cast, func, select, String as SqlString
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    PERM_ANNOUNCEMENTS_CREATE,
    PERM_APPLICATIONS_VIEW,
    PERM_JOBS_CREATE,
    PERM_NOC_APPROVE,
    PERM_NOC_VIEW,
    PERM_STUDENTS_VIEW,
    has_permission,
    is_admin_email,
    is_elevated_role,
)
from app.core.storage import (
    ATTACHMENT_TYPES,
    StorageError,
    delete_file,
    get_local_file_path,
    upload_document,
    upload_pdf,
    validate_attachment,
    validate_pdf,
)
from app.dependencies import get_current_user, get_db, require_permission, require_student
from app.models.db import (
    Announcement,
    AnnouncementAttachment,
    AnnouncementStatus,
    JobProfile,
    JobStatus,
    NocRequest,
    Resume,
)
from app.schemas.student import ResumeResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/resume", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    label: Optional[str] = Form(None),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    # Check limits
    count = await db.scalar(
        select(func.count(Resume.id)).where(Resume.userId == user_payload["sub"])
    )
    if count and count >= settings.max_resumes_per_student:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum resumes limit reached ({settings.max_resumes_per_student}).",
        )

    # Read the entire body — size validation happens inside validate_pdf
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > settings.allowed_pdf_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.allowed_pdf_size_mb} MB limit. "
                   f"Received {len(content) / (1024 * 1024):.1f} MB.",
        )

    # PDF magic-byte validation (not trusting extension or content-type)
    try:
        validate_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Upload to Cloudinary or local disk
    result = upload_pdf(
        content,
        folder=f"resumes/{user_payload['sub']}",
        public_id=str(uuid.uuid4()),
    )

    resume_label = (label or "").strip() or file.filename or "Resume"
    resume = Resume(
        id=str(uuid.uuid4()),
        userId=user_payload["sub"],
        label=resume_label,
        fileUrl=result["secure_url"],
        fileName=file.filename or "Resume.pdf",
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    return resume


@router.post("/admin/noc-document")
async def upload_noc_document(
    file: UploadFile = File(...),
    admin_payload: dict = Depends(require_permission(PERM_NOC_APPROVE)),
):
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        validate_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = upload_pdf(content, folder="noc_docs", public_id=str(uuid.uuid4()))
    return {"url": result["secure_url"]}


@router.post("/admin/announcement-attachment")
async def upload_announcement_attachment(
    file: UploadFile = File(...),
    token_payload: dict = Depends(require_permission(PERM_ANNOUNCEMENTS_CREATE)),
):
    """
    Stage one file for an announcement that may not exist yet.

    The composer uploads while the author is still writing, so the file is
    stored first and the row that owns it is written when the announcement is
    saved. A file nobody attaches is an orphan on disk, which is the cost of
    letting the author see the upload succeed before publishing.
    """
    content = await file.read()
    filename = file.filename or "attachment"

    try:
        extension, media_type = validate_attachment(
            content, filename, settings.allowed_pdf_size_mb
        )
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = upload_document(
        content,
        folder="announcement_docs",
        public_id=str(uuid.uuid4()),
        extension=extension,
    )
    return {
        "url": result["secure_url"],
        "fileName": filename,
        "mimeType": media_type,
        "sizeBytes": len(content),
    }


# Narrower than an announcement's: a company drive attaches a job description
# or a poster, not a spreadsheet or a shortlist.
EVENT_ATTACHMENT_EXTENSIONS = {"pdf", "png"}
EVENT_ATTACHMENT_MAX_MB = 4


@router.post("/admin/event-attachment")
async def upload_event_attachment(
    file: UploadFile = File(...),
    token_payload: dict = Depends(require_permission(PERM_JOBS_CREATE)),
):
    """
    Stage one file for a company event that may not exist yet, the same
    stage-before-save flow the announcement composer uses.
    """
    content = await file.read()
    filename = file.filename or "attachment"

    try:
        extension, media_type = validate_attachment(content, filename, EVENT_ATTACHMENT_MAX_MB)
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if extension not in EVENT_ATTACHMENT_EXTENSIONS:
        allowed = ", ".join(f".{name}" for name in sorted(EVENT_ATTACHMENT_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"'{filename}' is not accepted here. Allowed: {allowed}.")

    result = upload_document(
        content,
        folder="event_docs",
        public_id=str(uuid.uuid4()),
        extension=extension,
    )
    return {
        "url": result["secure_url"],
        "fileName": filename,
        "mimeType": media_type,
        "sizeBytes": len(content),
    }


@router.get("/files/{file_path:path}")
async def get_uploaded_file(
    file_path: str,
    token_payload: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = token_payload.get("sub")
    user_role = token_payload.get("role")
    user_email = token_payload.get("email", "")
    is_admin = (
        is_elevated_role(user_role)
        or is_admin_email(user_email)
        or has_permission(token_payload, PERM_STUDENTS_VIEW)
        or has_permission(token_payload, PERM_APPLICATIONS_VIEW)
    )

    clean_path = file_path.lstrip("/")
    if ".." in clean_path or "\\" in clean_path:
        raise HTTPException(status_code=400, detail="Invalid path characters.")

    local_path = get_local_file_path(clean_path)
    if not local_path:
        raise HTTPException(status_code=404, detail="File not found.")

    # Security: Non-admin students can only access files in their own folder or their own NOC documents
    if not is_admin:
        from app.core.storage import LOCAL_UPLOADS_DIR
        try:
            resolved_rel = str(local_path.relative_to(LOCAL_UPLOADS_DIR.resolve()))
            is_own_resume = resolved_rel.startswith(f"resumes/{user_id}/")
            is_noc_doc = False
            if resolved_rel.startswith("noc_docs/"):
                if has_permission(token_payload, PERM_NOC_VIEW):
                    # Anyone holding noc.view (e.g. FACULTY, who is not
                    # `is_admin` above since that flag also implies
                    # students.view/applications.view, broader than NOC
                    # access alone) can read any NOC document, the same read
                    # access the admin NOC list/detail endpoints already give
                    # them via require_permission(PERM_NOC_VIEW).
                    is_noc_doc = True
                else:
                    # Ask whether *any* of the caller's NOC documents is this
                    # file. Loading a single arbitrary row and comparing
                    # against it 403'd a student who had more than one NOC
                    # document.
                    is_noc_doc = bool(
                        await db.scalar(
                            select(NocRequest.id)
                            .where(
                                NocRequest.userId == user_id,
                                NocRequest.documentUrl.like(f"%{resolved_rel}"),
                            )
                            .limit(1)
                        )
                    )

            # An attachment is readable by any signed-in user once the
            # announcement carrying it is published, and by nobody while it is
            # still a draft. A staged file no announcement owns stays private.
            is_published_attachment = False
            if resolved_rel.startswith("announcement_docs/"):
                owner_status = await db.scalar(
                    select(Announcement.status)
                    .join(
                        AnnouncementAttachment,
                        AnnouncementAttachment.announcementId == Announcement.id,
                    )
                    .where(AnnouncementAttachment.fileUrl.like(f"%{resolved_rel}"))
                )
                is_published_attachment = owner_status == AnnouncementStatus.PUBLISHED

            # Same rule as an announcement's: visible once the drive is no
            # longer a draft, private while it still is. `attachments` is a
            # JSON array rather than a child table, so this is a text search
            # over the cast column rather than a join.
            is_visible_event_attachment = False
            if resolved_rel.startswith("event_docs/"):
                owner_status = await db.scalar(
                    select(JobProfile.status).where(
                        JobProfile.attachments.isnot(None),
                        cast(JobProfile.attachments, SqlString).like(f"%{resolved_rel}%"),
                    )
                )
                is_visible_event_attachment = owner_status is not None and owner_status != JobStatus.DRAFT

            if not (is_own_resume or is_noc_doc or is_published_attachment or is_visible_event_attachment):
                raise HTTPException(status_code=403, detail="Not authorized to access this file.")
        except ValueError:
            raise HTTPException(status_code=403, detail="Not authorized to access this file.")

    extension = local_path.suffix.lstrip(".").lower()
    media_type = ATTACHMENT_TYPES.get(extension, "application/pdf")
    # A browser renders a PDF or an image in place; anything else downloads.
    inline = media_type == "application/pdf" or media_type.startswith("image/")
    disposition = "inline" if inline else "attachment"

    return FileResponse(
        path=local_path,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{local_path.name}"'},
    )


