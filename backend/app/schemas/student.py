from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Literal, Optional, get_args

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Mirrors BLOOD_GROUPS / GENDERS in frontend/src/lib/profile-schema.ts.
BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
Gender = Literal["Male", "Female"]

# The same values as a tuple, for anything that needs to iterate them.
BLOOD_GROUPS_VALUES = get_args(BloodGroup)
GENDERS_VALUES = get_args(Gender)

MAX_PERCENT_DECIMALS = 2


def _round_trip_decimals(value: float) -> int:
    """
    How many decimal places the caller actually sent.

    `Decimal(str(value))` reads the digits as written instead of the binary
    expansion, so 87.65 is two places rather than the seventeen that
    `Decimal(87.65)` would report.
    """
    try:
        exponent = Decimal(str(value)).normalize().as_tuple().exponent
    except (InvalidOperation, ValueError):
        return 0
    return -exponent if isinstance(exponent, int) and exponent < 0 else 0


class StudentProfileUpdate(BaseModel):
    # name, rollNumber, branch, degree, and batch come from the placement
    # office's roster import and are deliberately absent here: this schema is
    # the boundary the student-facing PATCH /profile route validates against,
    # so a field that doesn't exist on it can never be set by a student.
    #
    # cgpa and backlogs are absent for the same reason, not because they are
    # roster-imported: they drive job-eligibility checks and are shown to
    # recruiters as fact, so letting a student self-report them would let an
    # ineligible student fabricate eligibility. Only the placement office can
    # correct them, through StudentAcademicCorrection below.
    personalEmail: Optional[str] = None
    contactNumber: Optional[str] = None
    altContactNumber: Optional[str] = None
    # Closed lists, not free text. A value outside them is rejected here even
    # though the form only offers valid ones — the form is not the boundary.
    gender: Optional[Gender] = None
    bloodGroup: Optional[BloodGroup] = None
    dateOfBirth: Optional[datetime] = None
    currentAddress: Optional[str] = None
    class10Percent: Optional[float] = Field(default=None, ge=0, le=100)
    class12Percent: Optional[float] = Field(default=None, ge=0, le=100)

    @field_validator("class10Percent", "class12Percent")
    @classmethod
    def _cap_precision(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if _round_trip_decimals(value) > MAX_PERCENT_DECIMALS:
            raise ValueError(
                f"Use at most {MAX_PERCENT_DECIMALS} decimal places."
            )
        return value


class StudentAcademicCorrection(BaseModel):
    """
    The placement-office-only counterpart to the cgpa/backlogs omitted above.
    Bound to `PATCH /students/admin/{id}/academic`, guarded by
    `students.update`, never by the student-facing profile route.
    """

    cgpa: Optional[float] = Field(default=None, ge=0, le=10)
    backlogs: Optional[int] = Field(default=None, ge=0, le=20)

    @field_validator("cgpa")
    @classmethod
    def _cap_precision(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        if _round_trip_decimals(value) > MAX_PERCENT_DECIMALS:
            raise ValueError(
                f"Use at most {MAX_PERCENT_DECIMALS} decimal places."
            )
        return value


class StudentAcademicResponse(BaseModel):
    id: str
    cgpa: Optional[float] = None
    backlogs: int = 0

    model_config = ConfigDict(from_attributes=True)


class AadhaarUpdate(BaseModel):
    aadhaar: str = Field(..., min_length=12, max_length=12)

class PanUpdate(BaseModel):
    pan: str = Field(..., min_length=10, max_length=10)

# A college ID number has no national format, so it is validated on shape
# rather than on a fixed length: institutes issue anything from a roll number
# to a hyphenated card serial.
COLLEGE_ID_PATTERN = r"^[A-Za-z0-9/-]{4,20}$"

class CollegeIdUpdate(BaseModel):
    collegeId: str = Field(..., pattern=COLLEGE_ID_PATTERN)

class ResumeUpdate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)

class ResumeResponse(BaseModel):
    id: str
    label: str
    fileUrl: str
    fileName: str
    uploadedAt: datetime

class AadhaarUnlockRequest(BaseModel):
    aadhaar: str = Field(..., min_length=12, max_length=12)

class PanUnlockRequest(BaseModel):
    pan: str = Field(..., min_length=10, max_length=10)

class CollegeIdUnlockRequest(BaseModel):
    collegeId: str = Field(..., pattern=COLLEGE_ID_PATTERN)

class StudentProfileResponse(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: str
    personalEmail: Optional[str] = None
    rollNumber: Optional[str] = None
    branch: Optional[str] = None
    batch: Optional[int] = None
    degree: Optional[str] = None
    category: Optional[str] = None
    gender: Optional[str] = None
    dateOfBirth: Optional[datetime] = None
    bloodGroup: Optional[str] = None
    contactNumber: Optional[str] = None
    altContactNumber: Optional[str] = None
    currentAddress: Optional[str] = None
    permanentAddress: Optional[str] = None
    aadhaarProvided: bool = False
    aadhaarMasked: Optional[str] = None
    aadhaarDocProvided: bool = False
    aadhaarDocFileName: Optional[str] = None
    panProvided: bool = False
    panMasked: Optional[str] = None
    panDocProvided: bool = False
    panDocFileName: Optional[str] = None
    collegeIdProvided: bool = False
    collegeIdMasked: Optional[str] = None
    collegeIdDocProvided: bool = False
    collegeIdDocFileName: Optional[str] = None
    class10Percent: Optional[float] = None
    class12Percent: Optional[float] = None
    cgpa: Optional[float] = None
    backlogs: int = 0
    bans: int = 0

    model_config = ConfigDict(from_attributes=True)


class MissedCompanyFlag(BaseModel):
    companyId: str
    companyName: str
    jobTitle: str
    registrationDeadline: datetime


class StudentApplicationFlag(BaseModel):
    userId: str
    name: Optional[str] = None
    email: Optional[str] = None
    rollNumber: Optional[str] = None
    branch: Optional[str] = None
    batch: Optional[int] = None
    longestMissedStreak: int
    totalEligibleCompanies: int
    totalAppliedCompanies: int
    missedCompanies: list[MissedCompanyFlag]


