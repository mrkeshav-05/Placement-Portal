"""Recording an internship's PPO outcome."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.db import OfferStatus, OfferType, PpoStatus
from app.services.ppo import resolve_pending_internship, set_ppo_outcome


def _internship(**overrides):
    values = dict(
        id="int_1",
        userId="stu_1",
        companyId="cmp_1",
        type=OfferType.INTERNSHIP,
        source="ON_CAMPUS",
        batch=2027,
        location="Pune",
        jobTitle="SDE Intern",
        ppoStatus=PpoStatus.PENDING,
        updatedAt=None,
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def _db(scalar_results=(), scalars_results=()):
    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=list(scalar_results))
    added = []
    db.add = MagicMock(side_effect=added.append)
    result = MagicMock()
    result.all.return_value = list(scalars_results)
    db.scalars = AsyncMock(return_value=result)
    return db, added


def run(db, internship, outcome, **kwargs):
    kwargs.setdefault("ctc", None)
    kwargs.setdefault("job_title", None)
    return asyncio.run(set_ppo_outcome(db, internship, outcome, recorder_id="adm_1", **kwargs))


def test_received_writes_a_ppo_offer_linked_to_the_internship():
    internship = _internship()
    db, added = _db([None])
    ppo = run(db, internship, PpoStatus.RECEIVED, ctc=1_400_000)

    assert internship.ppoStatus == PpoStatus.RECEIVED
    assert ppo in added
    assert ppo.type == OfferType.PPO
    assert ppo.status == OfferStatus.OFFERED
    assert ppo.ctc == 1_400_000
    assert ppo.internshipOfferId == "int_1"
    assert (ppo.userId, ppo.companyId, ppo.batch) == ("stu_1", "cmp_1", 2027)
    assert ppo.jobTitle == "SDE Intern"


def test_received_needs_a_ctc():
    db, _ = _db([None])
    with pytest.raises(HTTPException) as exc:
        run(db, _internship(), PpoStatus.RECEIVED)
    assert exc.value.status_code == 400


def test_not_received_leaves_no_ppo_and_frees_the_student():
    internship = _internship()
    db, added = _db([None])
    assert run(db, internship, PpoStatus.NOT_RECEIVED) is None
    assert internship.ppoStatus == PpoStatus.NOT_RECEIVED
    assert added == []


def test_changing_received_to_not_received_revokes_the_ppo():
    existing = SimpleNamespace(status=OfferStatus.OFFERED, decidedAt=None, updatedAt=None)
    internship = _internship(ppoStatus=PpoStatus.RECEIVED)
    db, _ = _db([existing])
    run(db, internship, PpoStatus.NOT_RECEIVED)
    assert existing.status == OfferStatus.REVOKED
    assert internship.ppoStatus == PpoStatus.NOT_RECEIVED


def test_received_again_revives_a_revoked_ppo_instead_of_duplicating():
    existing = SimpleNamespace(
        status=OfferStatus.REVOKED, ctc=900_000, jobTitle="SDE", updatedAt=None
    )
    db, added = _db([existing])
    ppo = run(db, _internship(), PpoStatus.RECEIVED, ctc=1_100_000)
    assert ppo is existing and added == []
    assert ppo.status == OfferStatus.OFFERED and ppo.ctc == 1_100_000


def test_only_an_internship_can_have_a_ppo_outcome():
    db, _ = _db()
    with pytest.raises(HTTPException):
        run(db, _internship(type=OfferType.FTE), PpoStatus.NOT_RECEIVED)


def test_a_hand_recorded_ppo_settles_the_pending_internship():
    pending = _internship()
    db, _ = _db(scalars_results=[pending])
    asyncio.run(resolve_pending_internship(db, "stu_1", "cmp_1"))
    assert pending.ppoStatus == PpoStatus.RECEIVED


def test_bulk_schema_bounds_and_statuses():
    from pydantic import ValidationError

    from app.schemas.offer import PpoBulkUpdate

    assert PpoBulkUpdate(offerIds=["a"], status="NOT_RECEIVED").ctc is None
    with pytest.raises(ValidationError):
        PpoBulkUpdate(offerIds=[], status="NOT_RECEIVED")
    with pytest.raises(ValidationError):
        PpoBulkUpdate(offerIds=["a"], status="MAYBE")
    with pytest.raises(ValidationError):
        PpoBulkUpdate(offerIds=[str(n) for n in range(201)], status="NOT_RECEIVED")


class TestBulkPpoEndpoint:
    @pytest.fixture()
    def client(self):
        from fastapi.testclient import TestClient

        from app.core.security import get_current_user
        from main import app

        with TestClient(app, raise_server_exceptions=False) as test_client:
            test_client.app.dependency_overrides[get_current_user] = lambda: {
                "sub": "usr_admin",
                "email": "placements@iiitl.ac.in",
                "role": "SUPER_ADMIN",
            }
            yield test_client
            test_client.app.dependency_overrides.clear()

    def _install(self, client, offers):
        from app.dependencies import get_db

        async def _fake_db():
            db = AsyncMock()
            result = MagicMock()
            result.all.return_value = offers
            db.scalars = AsyncMock(return_value=result)
            db.scalar = AsyncMock(return_value=None)
            db.add = MagicMock()
            db.commit = AsyncMock()
            yield db

        client.app.dependency_overrides[get_db] = _fake_db

    def test_updates_internships_and_reports_the_rest(self, client):
        intern = _internship(id="a")
        fte = _internship(id="b", type=OfferType.FTE)
        self._install(client, [intern, fte])

        res = client.post(
            "/api/v1/offers/ppo-outcomes/bulk",
            json={"offerIds": ["a", "b", "missing"], "status": "NOT_RECEIVED"},
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["updated"] == 1
        assert {s["offerId"] for s in body["skipped"]} == {"b", "missing"}
        assert intern.ppoStatus == PpoStatus.NOT_RECEIVED

    def test_received_without_a_ctc_is_refused(self, client):
        self._install(client, [_internship(id="a")])
        res = client.post(
            "/api/v1/offers/ppo-outcomes/bulk", json={"offerIds": ["a"], "status": "RECEIVED"}
        )
        assert res.status_code == 400
