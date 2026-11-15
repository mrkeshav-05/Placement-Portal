from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

QUESTION_FIELDS = (
    "dsaQuestions",
    "oopsQuestions",
    "dbmsQuestions",
    "osQuestions",
    "cnQuestions",
    "sqlQuestions",
    "systemDesignQuestions",
    "csFundamentalsQuestions",
    "resumeQuestions",
    "projectsDiscussed",
    "codingQuestions",
    "aptitudeQuestions",
    "hrQuestions",
    "behavioralQuestions",
    "resources",
    "unansweredQuestions",
    "tips",
)


class InterviewExperienceAuthorSummary(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    rollNumber: Optional[str] = None
    branch: Optional[str] = None
    batch: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class InterviewExperienceBase(BaseModel):
    companyName: str = Field(..., min_length=2, max_length=200)
    role: str = Field(..., min_length=2, max_length=150)
    batch: int = Field(..., ge=2000, le=2100)
    interviewType: str = Field(..., min_length=2, max_length=100)
    # Intern, Intern + FTE or FTE. Optional so rows from before the field
    # existed still serialise; the student form requires it.
    opportunityType: Optional[Literal["INTERN", "INTERN_FTE", "FTE"]] = None
    # Optional context shown beside an entry in the question bank.
    difficulty: Optional[Literal["EASY", "MEDIUM", "HARD"]] = None
    outcome: Optional[Literal["SELECTED", "NOT_SELECTED", "NOT_DISCLOSED"]] = None
    dsaQuestions: Optional[str] = Field(None, max_length=8000)
    oopsQuestions: Optional[str] = Field(None, max_length=8000)
    dbmsQuestions: Optional[str] = Field(None, max_length=8000)
    osQuestions: Optional[str] = Field(None, max_length=8000)
    cnQuestions: Optional[str] = Field(None, max_length=8000)
    sqlQuestions: Optional[str] = Field(None, max_length=8000)
    systemDesignQuestions: Optional[str] = Field(None, max_length=8000)
    csFundamentalsQuestions: Optional[str] = Field(None, max_length=8000)
    resumeQuestions: Optional[str] = Field(None, max_length=8000)
    projectsDiscussed: Optional[str] = Field(None, max_length=8000)
    codingQuestions: Optional[str] = Field(None, max_length=8000)
    aptitudeQuestions: Optional[str] = Field(None, max_length=8000)
    hrQuestions: Optional[str] = Field(None, max_length=8000)
    behavioralQuestions: Optional[str] = Field(None, max_length=8000)
    resources: Optional[str] = Field(None, max_length=4000)
    unansweredQuestions: Optional[str] = Field(None, max_length=4000)
    tips: Optional[str] = Field(None, max_length=4000)

    @field_validator(*QUESTION_FIELDS, mode="before")
    @classmethod
    def blank_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None


class InterviewExperienceCreate(InterviewExperienceBase):
    @model_validator(mode="after")
    def require_some_content(self) -> "InterviewExperienceCreate":
        if not any(getattr(self, field) for field in QUESTION_FIELDS):
            raise ValueError(
                "Share at least one question, resource, or tip so the submission is useful to other students."
            )
        return self


class InterviewExperienceReviewRequest(BaseModel):
    reviewNote: Optional[str] = Field(None, max_length=2000)


class InterviewExperienceResponse(InterviewExperienceBase):
    id: str
    userId: str
    status: str
    reviewNote: Optional[str] = None
    reviewedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminInterviewExperienceResponse(InterviewExperienceResponse):
    author: Optional[InterviewExperienceAuthorSummary] = None
    reviewedById: Optional[str] = None


class InterviewExperienceMetricsResponse(BaseModel):
    total: int
    pending: int
    approved: int
    rejected: int


class BankCompanyResponse(BaseModel):
    """One company in the question bank's search list."""

    company: str
    count: int
    roles: list[str]
    latestBatch: int
    lastSharedAt: datetime


class BankGroupResponse(BaseModel):
    """Every experience for one role + opportunity type at a company."""

    role: str
    opportunityType: str
    count: int
    batches: list[int]
    interviewTypes: list[str]
    experiences: list[InterviewExperienceResponse]


class BankCompanyDetailResponse(BaseModel):
    company: str
    total: int
    groups: list[BankGroupResponse]
