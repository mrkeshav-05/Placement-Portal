from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.rich_text import sanitize_announcement_html, strip_html_to_text

# The stored value is sanitized HTML, so this bounds the *visible* text
# (checked after sanitizing and stripping tags in the validators below),
# not the raw markup — a heavily formatted announcement carries more bytes
# than characters, and a bare byte cap would reject it for formatting alone.
# 50,000 raw characters is the hard ceiling on the field itself, generous
# enough that no announcement written through the editor's toolbar could
# reach it before the 10,000-character text limit already had.
_CONTENT_TEXT_MIN = 2
_CONTENT_TEXT_MAX = 10000
_CONTENT_RAW_MAX = 50000

class AnnouncementCompanySummary(BaseModel):
    id: str
    name: str
    logoUrl: Optional[str] = None
    website: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AnnouncementAuthorSummary(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AnnouncementAttachmentInput(BaseModel):
    """One already-uploaded file, as returned by the upload endpoint."""
    fileName: str = Field(..., min_length=1, max_length=255)
    fileUrl: str = Field(..., min_length=1, max_length=1000)
    mimeType: str = Field(..., min_length=1, max_length=120)
    sizeBytes: int = Field(..., ge=0)

class AnnouncementAttachmentResponse(AnnouncementAttachmentInput):
    id: str
    uploadedAt: datetime

    model_config = ConfigDict(from_attributes=True)

class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=1, max_length=_CONTENT_RAW_MAX)
    category: str = Field(default="GENERAL")
    tags: list[str] = Field(default_factory=list)
    companyId: Optional[str] = None
    # The drive the announcement is about, when it is about one.
    jobProfileId: Optional[str] = None

    @field_validator("content")
    @classmethod
    def _sanitize_content(cls, value: str) -> str:
        cleaned = sanitize_announcement_html(value)
        text_length = len(strip_html_to_text(cleaned))
        if text_length < _CONTENT_TEXT_MIN:
            raise ValueError("Content must be at least 2 characters.")
        if text_length > _CONTENT_TEXT_MAX:
            raise ValueError("Content cannot exceed 10,000 characters.")
        return cleaned

class AnnouncementCreate(AnnouncementBase):
    attachments: list[AnnouncementAttachmentInput] = Field(default_factory=list, max_length=10)
    # Saving a draft is the deliberate act; an omitted status publishes, which
    # keeps every existing caller behaving as it did.
    status: str = Field(default="PUBLISHED")

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=_CONTENT_RAW_MAX)
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    companyId: Optional[str] = None
    jobProfileId: Optional[str] = None
    status: Optional[str] = None
    # Sent whole or not at all: an omitted list leaves the files alone, and a
    # list replaces them, which is what the composer's remove control means.
    attachments: Optional[list[AnnouncementAttachmentInput]] = Field(None, max_length=10)

    @field_validator("content")
    @classmethod
    def _sanitize_content(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = sanitize_announcement_html(value)
        text_length = len(strip_html_to_text(cleaned))
        if text_length < _CONTENT_TEXT_MIN:
            raise ValueError("Content must be at least 2 characters.")
        if text_length > _CONTENT_TEXT_MAX:
            raise ValueError("Content cannot exceed 10,000 characters.")
        return cleaned

class AnnouncementResponse(AnnouncementBase):
    id: str
    status: str
    jobTitle: Optional[str] = None
    publishedAt: Optional[datetime] = None
    createdAt: datetime
    createdById: str
    company: Optional[AnnouncementCompanySummary] = None
    createdByName: Optional[str] = None
    createdByEmail: Optional[str] = None
    attachments: list[AnnouncementAttachmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

