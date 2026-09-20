from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, field_validator

# Every array column on JobProfile is nullable in Postgres — Prisma declares
# them `String[]` but the migration did not add NOT NULL, and a row written
# without one stores NULL rather than an empty array. Pydantic rejects None
# for a `list[str]`, which turned every such row into a 500 from this
# endpoint. Read as "absent means none of them", which is what the columns
# mean everywhere they are used.
_LIST_COLUMNS = (
    "locations",
    "allowedBranches",
    "allowedDegrees",
    "allowedGenders",
)


class JobAttachment(BaseModel):
    fileName: str
    fileUrl: str
    mimeType: str
    sizeBytes: int


class JobBase(BaseModel):
    companyId: str
    title: str
    type: str
    locations: list[str] = []
    ctcStipend: Optional[float] = None
    ctcStipendInfo: Optional[str] = None
    minCGPA: float = 0.0
    # Unset means no threshold, the same convention `minCGPA`'s default
    # already follows, rather than a separate "restricted?" flag.
    min10Percent: Optional[float] = None
    min12Percent: Optional[float] = None
    maxBacklogs: int = 0
    maxBans: int = 0
    allowedBranches: list[str] = []
    allowedDegrees: list[str] = []
    allowedGenders: list[str] = []
    jobCategory: Optional[str] = None
    batch: int
    placementYear: int
    registrationDeadline: datetime
    description: Optional[str] = None
    openingOverview: Optional[str] = None
    cap: Optional[str] = None
    companyBond: Optional[str] = None
    duration: Optional[str] = None
    redirectUrl: Optional[str] = None
    attachments: list[JobAttachment] = []

    @field_validator(*_LIST_COLUMNS, "attachments", mode="before")
    @classmethod
    def empty_when_null(cls, value: Any) -> Any:
        return [] if value is None else value

class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    locations: Optional[list[str]] = None
    ctcStipend: Optional[float] = None
    ctcStipendInfo: Optional[str] = None
    minCGPA: Optional[float] = None
    min10Percent: Optional[float] = None
    min12Percent: Optional[float] = None
    maxBacklogs: Optional[int] = None
    maxBans: Optional[int] = None
    allowedBranches: Optional[list[str]] = None
    allowedDegrees: Optional[list[str]] = None
    allowedGenders: Optional[list[str]] = None
    jobCategory: Optional[str] = None
    batch: Optional[int] = None
    placementYear: Optional[int] = None
    registrationDeadline: Optional[datetime] = None
    description: Optional[str] = None
    openingOverview: Optional[str] = None
    cap: Optional[str] = None
    companyBond: Optional[str] = None
    duration: Optional[str] = None
    redirectUrl: Optional[str] = None
    attachments: Optional[list[JobAttachment]] = None

class JobStatusUpdate(BaseModel):
    status: str

class JobCompanySummary(BaseModel):
    """
    Enough of the company to render a row without a second request.

    The student-facing lists show a company name and a logo, and the colour
    and initials they are drawn with are derived from the name. Sending the id
    alone would put a per-row lookup behind every list.
    """
    id: str
    name: str
    logoUrl: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class JobResponse(JobBase):
    id: str
    status: str
    createdAt: datetime
    createdById: str
    company: Optional[JobCompanySummary] = None

    model_config = ConfigDict(from_attributes=True)
