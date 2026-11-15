"""
An approved NOC is an internship offer.

Approving an NOC (or a student recording an internship that needs no NOC)
writes an `Offer` of type INTERNSHIP, so the internship counts in the season's
statistics and closes on-campus applications, until its PPO outcome is
recorded, under the placement policy (`app/services/placement_policy.py`). Rejecting a previously
approved NOC revokes that offer, which keeps it on file but out of every count.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import (
    Company,
    NocRequest,
    NocSource,
    Offer,
    OfferSource,
    OfferStatus,
    OfferType,
    User,
)
from app.services.placement_stats import COUNTED_OFFER_STATUSES


async def _resolve_company(db: AsyncSession, name: str) -> Company:
    """
    The NOC's company is free text; an Offer needs a Company row. Match an
    existing one by name, ignoring case, before creating a new one, so an
    internship at a recruiter the office already knows lands on that record.
    """
    cleaned = name.strip()
    company = await db.scalar(select(Company).where(func.lower(Company.name) == cleaned.lower()))
    if company:
        return company
    company = Company(id=f"cuid_{uuid.uuid4().hex[:20]}", name=cleaned)
    db.add(company)
    await db.flush()
    return company


async def record_noc_internship(
    db: AsyncSession, noc: NocRequest, student: User, recorder_id: str
) -> Offer:
    """
    Create, or bring up to date, the internship Offer behind an approved NOC.

    Idempotent: re-approving updates the same row. If the office already
    recorded this internship (an on-campus drive outcome at the same company),
    that offer is linked rather than duplicated.
    """
    if noc.stipend is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter the monthly stipend before approving; the NOC is recorded as an internship offer.",
        )
    if student.batch is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The student's batch is not set, so the internship cannot be placed in a season.",
        )

    now = datetime.now(timezone.utc)
    offer = await db.scalar(select(Offer).where(Offer.nocRequestId == noc.id))

    if offer is None:
        offer = await db.scalar(
            select(Offer)
            .join(Offer.company)
            .where(
                Offer.userId == student.id,
                Offer.type == OfferType.INTERNSHIP,
                Offer.status.in_(COUNTED_OFFER_STATUSES),
                Offer.nocRequestId.is_(None),
                func.lower(Company.name) == noc.company.strip().lower(),
            )
        )
        if offer is not None:
            offer.nocRequestId = noc.id

    if offer is None:
        company = await _resolve_company(db, noc.company)
        offer = Offer(
            id=f"cuid_{uuid.uuid4().hex[:20]}",
            userId=student.id,
            companyId=company.id,
            nocRequestId=noc.id,
            type=OfferType.INTERNSHIP,
            source=(
                OfferSource.OFF_CAMPUS if noc.source == NocSource.OFF_CAMPUS else OfferSource.ON_CAMPUS
            ),
            batch=student.batch,
            offeredAt=now,
            remarks="Recorded from an approved NOC request.",
            createdById=recorder_id,
        )
        db.add(offer)

    # The student is taking this internship: that is what the NOC is for.
    offer.status = OfferStatus.ACCEPTED
    offer.decidedAt = offer.decidedAt or now
    offer.stipend = noc.stipend
    offer.jobTitle = noc.jobTitle or offer.jobTitle
    offer.location = noc.city or offer.location
    offer.joiningDate = noc.startDate
    offer.endDate = noc.endDate
    offer.updatedAt = now
    return offer


async def revoke_noc_internship(db: AsyncSession, noc: NocRequest) -> Optional[Offer]:
    """A rejected NOC takes its internship, and any PPO recorded from it, out of the counts and the policy."""
    offer = await db.scalar(select(Offer).where(Offer.nocRequestId == noc.id))
    if offer is None:
        return None
    now = datetime.now(timezone.utc)
    offer.status = OfferStatus.REVOKED
    offer.decidedAt = now
    offer.updatedAt = now
    ppo = await db.scalar(select(Offer).where(Offer.internshipOfferId == offer.id))
    if ppo is not None and ppo.status != OfferStatus.REVOKED:
        ppo.status = OfferStatus.REVOKED
        ppo.decidedAt = now
        ppo.updatedAt = now
    return offer
