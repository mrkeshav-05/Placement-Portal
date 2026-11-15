"""
Recording an internship's PPO outcome.

An internship keeps its holder out of on-campus drives until the placement
cell records whether the company gave a PPO (`app/services/placement_policy.py`).

- NOT_RECEIVED: the student is open again.
- RECEIVED: the PPO is written as its own PPO `Offer` (linked back through
  `internshipOfferId`), so it counts in the placement statistics and is judged
  by the Dream / First Round rules like any other full-time offer.
- PENDING: the outcome is withdrawn; a PPO recorded from this internship is
  revoked, which keeps it on file but out of every count.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Offer, OfferStatus, OfferType, PpoStatus


async def set_ppo_outcome(
    db: AsyncSession,
    internship: Offer,
    outcome: PpoStatus,
    *,
    ctc: Optional[float],
    job_title: Optional[str],
    recorder_id: str,
) -> Optional[Offer]:
    """Apply the outcome to the internship and return the linked PPO offer, if any."""
    if internship.type != OfferType.INTERNSHIP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A PPO outcome can only be recorded on an internship offer.",
        )

    now = datetime.now(timezone.utc)
    ppo = await db.scalar(select(Offer).where(Offer.internshipOfferId == internship.id))

    if outcome == PpoStatus.RECEIVED:
        amount = ctc if ctc is not None else (ppo.ctc if ppo else None)
        if amount is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Enter the PPO's annual CTC: it is recorded as a PPO offer.",
            )
        if ppo is None:
            ppo = Offer(
                id=f"cuid_{uuid.uuid4().hex[:20]}",
                userId=internship.userId,
                companyId=internship.companyId,
                internshipOfferId=internship.id,
                type=OfferType.PPO,
                source=internship.source,
                batch=internship.batch,
                location=internship.location,
                offeredAt=now,
                remarks="Recorded from the internship's PPO outcome.",
                createdById=recorder_id,
            )
            db.add(ppo)
        if ppo.status is None or ppo.status == OfferStatus.REVOKED:
            ppo.status = OfferStatus.OFFERED
        ppo.ctc = amount
        ppo.jobTitle = (job_title or "").strip() or ppo.jobTitle or internship.jobTitle
        ppo.updatedAt = now
    elif ppo is not None and ppo.status != OfferStatus.REVOKED:
        ppo.status = OfferStatus.REVOKED
        ppo.decidedAt = now
        ppo.updatedAt = now

    internship.ppoStatus = outcome
    internship.updatedAt = now
    return ppo


async def resolve_pending_internship(db: AsyncSession, user_id: str, company_id: str) -> None:
    """
    A PPO recorded by hand (not through `set_ppo_outcome`) from the company a
    student interned at settles that internship's outcome as RECEIVED, so the
    internship stops holding the student back on top of a PPO already on file.
    """
    pending = (
        await db.scalars(
            select(Offer).where(
                Offer.userId == user_id,
                Offer.companyId == company_id,
                Offer.type == OfferType.INTERNSHIP,
                Offer.ppoStatus == PpoStatus.PENDING,
            )
        )
    ).all()
    for internship in pending:
        internship.ppoStatus = PpoStatus.RECEIVED
        internship.updatedAt = datetime.now(timezone.utc)
