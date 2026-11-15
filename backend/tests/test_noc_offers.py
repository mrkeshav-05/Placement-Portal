"""An approved NOC is recorded as an internship offer."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.db import NocSource, OfferSource, OfferStatus, OfferType
from app.services.noc_offers import record_noc_internship, revoke_noc_internship


def _noc(**overrides):
    values = dict(
        id="noc_1",
        company="Zoho",
        city="Chennai",
        source=NocSource.OFF_CAMPUS,
        stipend=45_000.0,
        jobTitle="SDE Intern",
        startDate=datetime(2027, 1, 5, tzinfo=timezone.utc),
        endDate=datetime(2027, 6, 30, tzinfo=timezone.utc),
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def _db(scalar_results):
    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=list(scalar_results))
    added = []
    db.add = MagicMock(side_effect=added.append)
    db.flush = AsyncMock()
    return db, added


STUDENT = SimpleNamespace(id="stu_1", batch=2027)


def test_approval_creates_an_accepted_internship_offer_with_the_noc_terms():
    company = SimpleNamespace(id="cmp_1", name="Zoho")
    # No offer linked to this NOC, no matching recorded internship, company exists.
    db, added = _db([None, None, company])
    offer = asyncio.run(record_noc_internship(db, _noc(), STUDENT, recorder_id="adm_1"))

    assert offer in added
    assert offer.type == OfferType.INTERNSHIP
    assert offer.status == OfferStatus.ACCEPTED
    assert offer.source == OfferSource.OFF_CAMPUS
    assert offer.companyId == "cmp_1"
    assert offer.nocRequestId == "noc_1"
    assert offer.stipend == 45_000.0
    assert offer.jobTitle == "SDE Intern"
    assert offer.batch == 2027
    assert offer.endDate == datetime(2027, 6, 30, tzinfo=timezone.utc)


def test_an_already_recorded_internship_is_linked_not_duplicated():
    existing = SimpleNamespace(
        nocRequestId=None, jobTitle=None, location=None, decidedAt=None, status=OfferStatus.OFFERED
    )
    db, added = _db([None, existing])
    offer = asyncio.run(record_noc_internship(db, _noc(), STUDENT, recorder_id="adm_1"))

    assert offer is existing
    assert added == []
    assert offer.nocRequestId == "noc_1"
    assert offer.status == OfferStatus.ACCEPTED


def test_approval_without_a_stipend_is_refused():
    db, _ = _db([])
    with pytest.raises(HTTPException) as exc:
        asyncio.run(record_noc_internship(db, _noc(stipend=None), STUDENT, recorder_id="adm_1"))
    assert exc.value.status_code == 400


def test_rejecting_revokes_the_linked_offer():
    linked = SimpleNamespace(id="off_1", status=OfferStatus.ACCEPTED, decidedAt=None, updatedAt=None)
    ppo = SimpleNamespace(status=OfferStatus.OFFERED, decidedAt=None, updatedAt=None)
    db, _ = _db([linked, ppo])
    asyncio.run(revoke_noc_internship(db, _noc()))
    assert linked.status == OfferStatus.REVOKED
    # A PPO recorded from the revoked internship goes with it.
    assert ppo.status == OfferStatus.REVOKED
