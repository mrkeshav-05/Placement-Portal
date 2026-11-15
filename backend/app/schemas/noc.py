from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class NocStudentSummary(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    rollNumber: Optional[str] = None
    branch: Optional[str] = None
    batch: Optional[int] = None
    degree: Optional[str] = None
    cgpa: Optional[float] = None
    contactNumber: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NocBase(BaseModel):
    company: str = Field(..., min_length=2, max_length=200)
    address: str = Field(..., min_length=2, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    # Optional: an empty string means "not given" (the columns stay NOT NULL).
    state: str = Field("", max_length=100)
    pincode: str = Field("", pattern=r"^([0-9]{6})?$", description="6-digit postal code, or empty")
    startDate: datetime
    endDate: datetime
    message: Optional[str] = Field(None, max_length=2000)
    # The internship's role, recorded on the Offer an approval creates.
    jobTitle: Optional[str] = Field(None, max_length=200)


class NocCreate(NocBase):
    # Monthly stipend in rupees; 0 for an unpaid internship. Required because
    # an approved NOC is recorded as an internship offer, which carries one.
    stipend: float = Field(..., ge=0, le=10_000_000)
    source: Literal["ON_CAMPUS", "OFF_CAMPUS"]
    # The student's proof of an off-campus offer, staged beforehand via
    # POST /uploads/noc-offcampus-proof — required exactly when source is
    # OFF_CAMPUS, checked below.
    offCampusProofUrl: Optional[str] = None
    # False records the internship's company and dates for the placement
    # cell's files without requesting a decision; see create_noc.
    nocRequired: bool = True

    @model_validator(mode="after")
    def validate_dates(self) -> "NocCreate":
        if self.endDate < self.startDate:
            raise ValueError("End date cannot be earlier than start date.")
        return self

    @model_validator(mode="after")
    def validate_offcampus_proof(self) -> "NocCreate":
        if self.source == "OFF_CAMPUS" and not (self.offCampusProofUrl or "").strip():
            raise ValueError(
                "Upload a supporting document (offer letter) for an off-campus offer."
            )
        return self


# A decision carries the placement cell's remarks, never the student's, so the
# field is named for who writes it.
class NocApproveRequest(BaseModel):
    adminRemarks: Optional[str] = Field(None, max_length=2000)
    documentUrl: Optional[str] = None
    # The office may correct (or, for a request filed before the field
    # existed, supply) the stipend recorded on the internship offer.
    stipend: Optional[float] = Field(None, ge=0, le=10_000_000)


class NocRejectRequest(BaseModel):
    adminRemarks: Optional[str] = Field(None, max_length=2000)


class NocDocument(BaseModel):
    documentUrl: str


# Independent of approve/reject — see NocRequest.verifiedByPlacementTeam.
class NocVerifyRequest(BaseModel):
    verified: bool


class NocResponse(NocBase):
    id: str
    userId: str
    status: str
    # Read-only for students: they see the decision remarks, they do not set them.
    adminRemarks: Optional[str] = None
    documentUrl: Optional[str] = None
    source: str
    offCampusProofUrl: Optional[str] = None
    verifiedByPlacementTeam: bool
    nocRequired: bool
    stipend: Optional[float] = None
    # The internship offer this NOC is recorded as, once approved.
    offerId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminNocResponse(NocResponse):
    student: Optional[NocStudentSummary] = None


class NocMetricsResponse(BaseModel):
    total: int
    pending: int
    approved: int
    rejected: int
    # Rows with nocRequired=false — counted apart from `approved` since no
    # decision was actually made on them.
    notRequired: int

