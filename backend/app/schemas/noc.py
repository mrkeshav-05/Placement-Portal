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
    state: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., pattern=r"^[0-9]{6}$", description="6-digit postal code")
    startDate: datetime
    endDate: datetime
    message: Optional[str] = Field(None, max_length=2000)


class NocCreate(NocBase):
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

