"""
SQLAlchemy ORM models — mirror of prisma/schema.prisma.

Prisma owns all migrations. FastAPI uses these models read/write
but never calls Base.metadata.create_all().

Table and column names match the Prisma-generated PostgreSQL schema exactly
(Prisma uses camelCase field names but maps them to snake_case columns).
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ---------------------------------------------------------------------------
# Enums — keep in sync with prisma/schema.prisma
# ---------------------------------------------------------------------------

class Role(str, enum.Enum):
    STUDENT = "STUDENT"
    PLACEMENT_VOLUNTEER = "PLACEMENT_VOLUNTEER"
    PLACEMENT_TEAM = "PLACEMENT_TEAM"
    SUPER_ADMIN = "SUPER_ADMIN"


class JobType(str, enum.Enum):
    INTERNSHIP = "INTERNSHIP"
    FTE = "FTE"
    INTERNSHIP_PPO = "INTERNSHIP_PPO"
    INTERNSHIP_FTE = "INTERNSHIP_FTE"


class JobStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"
    DRAFT = "DRAFT"


class ApplicationStatus(str, enum.Enum):
    APPLIED = "APPLIED"
    SHORTLISTED = "SHORTLISTED"
    INTERVIEW = "INTERVIEW"
    SELECTED = "SELECTED"
    REJECTED = "REJECTED"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    OFFER_DECLINED = "OFFER_DECLINED"
    WITHDRAWN = "WITHDRAWN"


class FeedbackType(str, enum.Enum):
    QUERY = "QUERY"
    FEEDBACK = "FEEDBACK"
    COMPLAINT = "COMPLAINT"


class NocStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class AnnouncementCategory(str, enum.Enum):
    COMPANY_EVENT = "COMPANY_EVENT"
    GENERAL = "GENERAL"


class AnnouncementStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class OfferType(str, enum.Enum):
    FTE = "FTE"
    PPO = "PPO"
    INTERNSHIP = "INTERNSHIP"


class OfferStatus(str, enum.Enum):
    OFFERED = "OFFERED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    REVOKED = "REVOKED"


class OfferSource(str, enum.Enum):
    ON_CAMPUS = "ON_CAMPUS"
    OFF_CAMPUS = "OFF_CAMPUS"
    HACKATHON = "HACKATHON"


class InterviewExperienceStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    emailVerified: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    image: Mapped[str | None] = mapped_column(String, nullable=True)
    # Mirrors Prisma. The backend never reads or verifies this; password
    # sign-in happens in the Auth.js layer and the backend only ever sees the
    # resulting signed JWT.
    passwordHash: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role, name="Role"), default=Role.STUDENT)
    customPermissions: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    personalEmail: Mapped[str | None] = mapped_column(String, nullable=True)
    rollNumber: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    branch: Mapped[str | None] = mapped_column(String, nullable=True)
    batch: Mapped[int | None] = mapped_column(Integer, nullable=True)
    degree: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)
    dateOfBirth: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bloodGroup: Mapped[str | None] = mapped_column(String, nullable=True)
    contactNumber: Mapped[str | None] = mapped_column(String, nullable=True)
    altContactNumber: Mapped[str | None] = mapped_column(String, nullable=True)
    currentAddress: Mapped[str | None] = mapped_column(Text, nullable=True)
    permanentAddress: Mapped[str | None] = mapped_column(Text, nullable=True)
    aadhaarEncrypted: Mapped[str | None] = mapped_column(String, nullable=True)
    aadhaarDocUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    aadhaarDocFileName: Mapped[str | None] = mapped_column(String, nullable=True)
    panCardEncrypted: Mapped[str | None] = mapped_column(String, nullable=True)
    panCardDocUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    panCardDocFileName: Mapped[str | None] = mapped_column(String, nullable=True)
    collegeIdEncrypted: Mapped[str | None] = mapped_column(String, nullable=True)
    collegeIdDocUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    collegeIdDocFileName: Mapped[str | None] = mapped_column(String, nullable=True)
    class10Percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    class12Percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    semGPAs: Mapped[list[float]] = mapped_column(ARRAY(Float), default=list)
    cgpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    cgpaBeforeDrop: Mapped[float | None] = mapped_column(Float, nullable=True)
    graduationGPA: Mapped[float | None] = mapped_column(Float, nullable=True)
    backlogs: Mapped[int] = mapped_column(Integer, default=0)
    bans: Mapped[int] = mapped_column(Integer, default=0)
    qrCodeData: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    applications: Mapped[list["Application"]] = relationship(back_populates="user")
    resumes: Mapped[list["Resume"]] = relationship(back_populates="user")
    feedbacks: Mapped[list["Feedback"]] = relationship(back_populates="user")
    noc_requests: Mapped[list["NocRequest"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")
    created_jobs: Mapped[list["JobProfile"]] = relationship(back_populates="created_by", foreign_keys="JobProfile.createdById")
    created_announcements: Mapped[list["Announcement"]] = relationship(back_populates="created_by")
    interview_experiences: Mapped[list["InterviewExperience"]] = relationship(
        back_populates="user", foreign_keys="InterviewExperience.userId"
    )
    reviewed_interview_experiences: Mapped[list["InterviewExperience"]] = relationship(
        back_populates="reviewed_by", foreign_keys="InterviewExperience.reviewedById"
    )
    offers: Mapped[list["Offer"]] = relationship(back_populates="user", foreign_keys="Offer.userId")
    recorded_offers: Mapped[list["Offer"]] = relationship(
        back_populates="created_by", foreign_keys="Offer.createdById"
    )


class Company(Base):
    __tablename__ = "Company"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    logoUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    placementSession: Mapped[int | None] = mapped_column(Integer, nullable=True)
    turnover: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    jobs: Mapped[list["JobProfile"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    announcements: Mapped[list["Announcement"]] = relationship(back_populates="company")
    offers: Mapped[list["Offer"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class JobProfile(Base):
    __tablename__ = "JobProfile"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    companyId: Mapped[str] = mapped_column(String, ForeignKey("Company.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    type: Mapped[JobType] = mapped_column(Enum(JobType, name="JobType"))
    locations: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    ctcStipend: Mapped[float | None] = mapped_column(Float, nullable=True)
    ctcStipendInfo: Mapped[str | None] = mapped_column(String, nullable=True)
    minCGPA: Mapped[float] = mapped_column(Float, default=0)
    maxBacklogs: Mapped[int] = mapped_column(Integer, default=0)
    maxBans: Mapped[int] = mapped_column(Integer, default=0)
    allowedBranches: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    allowedDegrees: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    allowedGenders: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    jobCategory: Mapped[str | None] = mapped_column(String, nullable=True)
    batch: Mapped[int] = mapped_column(Integer)
    placementYear: Mapped[int] = mapped_column(Integer)
    registrationDeadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, name="JobStatus"), default=JobStatus.DRAFT)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    openingOverview: Mapped[str | None] = mapped_column(Text, nullable=True)
    cap: Mapped[str | None] = mapped_column(String, nullable=True)
    companyBond: Mapped[str | None] = mapped_column(String, nullable=True)
    duration: Mapped[str | None] = mapped_column(String, nullable=True)
    redirectUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    attachments: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    createdById: Mapped[str] = mapped_column(String, ForeignKey("User.id"))

    company: Mapped["Company"] = relationship(back_populates="jobs")
    created_by: Mapped["User"] = relationship(back_populates="created_jobs", foreign_keys=[createdById])
    applications: Mapped[list["Application"]] = relationship(back_populates="job_profile", cascade="all, delete-orphan")
    coordinators: Mapped[list["Coordinator"]] = relationship(back_populates="job_profile", cascade="all, delete-orphan")
    offers: Mapped[list["Offer"]] = relationship(back_populates="job_profile")
    announcements: Mapped[list["Announcement"]] = relationship(back_populates="job_profile")


class Application(Base):
    __tablename__ = "Application"
    __table_args__ = (UniqueConstraint("userId", "jobProfileId"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    jobProfileId: Mapped[str] = mapped_column(String, ForeignKey("JobProfile.id", ondelete="CASCADE"))
    status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus, name="ApplicationStatus"), default=ApplicationStatus.APPLIED)
    appliedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    resumeId: Mapped[str | None] = mapped_column(String, ForeignKey("Resume.id", ondelete="SET NULL"), nullable=True)

    user: Mapped["User"] = relationship(back_populates="applications")
    job_profile: Mapped["JobProfile"] = relationship(back_populates="applications")
    resume: Mapped["Resume | None"] = relationship(back_populates="applications")
    offer: Mapped["Offer | None"] = relationship(back_populates="application")


class Offer(Base):
    """
    A recorded placement, pre-placement, or internship offer.

    `Application` tracks a student through a drive; `Offer` is the outcome, and
    it exists even for offers the portal never ran a drive for. Every package
    statistic on the admin dashboard is aggregated from this table.
    """

    __tablename__ = "Offer"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    companyId: Mapped[str] = mapped_column(String, ForeignKey("Company.id", ondelete="CASCADE"))
    jobProfileId: Mapped[str | None] = mapped_column(
        String, ForeignKey("JobProfile.id", ondelete="SET NULL"), nullable=True
    )
    applicationId: Mapped[str | None] = mapped_column(
        String, ForeignKey("Application.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    type: Mapped[OfferType] = mapped_column(Enum(OfferType, name="OfferType"))
    status: Mapped[OfferStatus] = mapped_column(
        Enum(OfferStatus, name="OfferStatus"), default=OfferStatus.OFFERED
    )
    source: Mapped[OfferSource] = mapped_column(
        Enum(OfferSource, name="OfferSource"), default=OfferSource.ON_CAMPUS
    )
    # Role as recorded, which may differ from the linked drive's title. Reads
    # fall back to jobProfile.title when this is null.
    jobTitle: Mapped[str | None] = mapped_column(String, nullable=True)
    # Placement season, held as the graduating batch year.
    batch: Mapped[int] = mapped_column(Integer)
    # Annual CTC in rupees for FTE and PPO offers.
    ctc: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Monthly stipend in rupees for internship offers.
    stipend: Mapped[float | None] = mapped_column(Float, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    offeredAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decidedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    joiningDate: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )
    createdById: Mapped[str] = mapped_column(String, ForeignKey("User.id"))

    user: Mapped["User"] = relationship(back_populates="offers", foreign_keys=[userId])
    company: Mapped["Company"] = relationship(back_populates="offers")
    job_profile: Mapped["JobProfile | None"] = relationship(back_populates="offers")
    application: Mapped["Application | None"] = relationship(back_populates="offer")
    created_by: Mapped["User"] = relationship(back_populates="recorded_offers", foreign_keys=[createdById])


class Announcement(Base):
    __tablename__ = "Announcement"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    companyId: Mapped[str | None] = mapped_column(String, ForeignKey("Company.id", ondelete="SET NULL"), nullable=True)
    # The drive this announcement is about, when it is about one.
    jobProfileId: Mapped[str | None] = mapped_column(
        String, ForeignKey("JobProfile.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    category: Mapped[AnnouncementCategory] = mapped_column(Enum(AnnouncementCategory, name="AnnouncementCategory"))
    # A DRAFT is placement-cell only. Every student-facing query filters to
    # PUBLISHED.
    status: Mapped[AnnouncementStatus] = mapped_column(
        Enum(AnnouncementStatus, name="AnnouncementStatus"), default=AnnouncementStatus.PUBLISHED
    )
    publishedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    createdById: Mapped[str] = mapped_column(String, ForeignKey("User.id"))

    company: Mapped["Company | None"] = relationship(back_populates="announcements")
    job_profile: Mapped["JobProfile | None"] = relationship(back_populates="announcements")
    created_by: Mapped["User"] = relationship(back_populates="created_announcements")
    attachments: Mapped[list["AnnouncementAttachment"]] = relationship(
        back_populates="announcement", cascade="all, delete-orphan"
    )


class AnnouncementAttachment(Base):
    __tablename__ = "AnnouncementAttachment"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    announcementId: Mapped[str] = mapped_column(
        String, ForeignKey("Announcement.id", ondelete="CASCADE")
    )
    fileName: Mapped[str] = mapped_column(String)
    fileUrl: Mapped[str] = mapped_column(String)
    mimeType: Mapped[str] = mapped_column(String)
    sizeBytes: Mapped[int] = mapped_column(Integer)
    uploadedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    announcement: Mapped["Announcement"] = relationship(back_populates="attachments")


class Feedback(Base):
    __tablename__ = "Feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    feedbackType: Mapped[FeedbackType] = mapped_column(Enum(FeedbackType, name="FeedbackType"))
    content: Mapped[str] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    adminResponse: Mapped[str | None] = mapped_column(Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolvedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="feedbacks")


class NocRequest(Base):
    __tablename__ = "NocRequest"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    company: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String)
    state: Mapped[str] = mapped_column(String)
    pincode: Mapped[str] = mapped_column(String)
    startDate: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    endDate: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[NocStatus] = mapped_column(Enum(NocStatus, name="NocStatus"), default=NocStatus.PENDING)
    # The student's own remarks. Only the student writes this.
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The placement cell's remarks on the decision, kept separate so approving
    # or rejecting never overwrites what the student wrote.
    adminRemarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    documentUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="noc_requests")


class InterviewExperience(Base):
    __tablename__ = "InterviewExperience"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    companyName: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    batch: Mapped[int] = mapped_column(Integer)
    interviewType: Mapped[str] = mapped_column(String)
    dsaQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    oopsQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    dbmsQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    osQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    cnQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    sqlQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    systemDesignQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    csFundamentalsQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    resumeQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    projectsDiscussed: Mapped[str | None] = mapped_column(Text, nullable=True)
    codingQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    aptitudeQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    hrQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    behavioralQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    resources: Mapped[str | None] = mapped_column(Text, nullable=True)
    unansweredQuestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[InterviewExperienceStatus] = mapped_column(
        Enum(InterviewExperienceStatus, name="InterviewExperienceStatus"),
        default=InterviewExperienceStatus.PENDING,
    )
    reviewNote: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewedById: Mapped[str | None] = mapped_column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    reviewedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="interview_experiences", foreign_keys=[userId])
    reviewed_by: Mapped["User | None"] = relationship(back_populates="reviewed_interview_experiences", foreign_keys=[reviewedById])


class Resume(Base):
    __tablename__ = "Resume"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String)
    fileUrl: Mapped[str] = mapped_column(String)
    fileName: Mapped[str] = mapped_column(String)
    publicId: Mapped[str | None] = mapped_column(String, nullable=True)
    uploadedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="resumes")
    applications: Mapped[list["Application"]] = relationship(back_populates="resume")



class Coordinator(Base):
    __tablename__ = "Coordinator"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    jobProfileId: Mapped[str] = mapped_column(String, ForeignKey("JobProfile.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String)

    job_profile: Mapped["JobProfile"] = relationship(back_populates="coordinators")


class TeamMember(Base):
    __tablename__ = "TeamMember"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    photoUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    displayOrder: Mapped[int] = mapped_column(Integer, default=0)


class Notification(Base):
    __tablename__ = "Notification"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="notifications")


class SystemSetting(Base):
    __tablename__ = "SystemSetting"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
