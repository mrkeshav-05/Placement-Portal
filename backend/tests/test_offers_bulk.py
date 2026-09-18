"""
Tests for recording a drive's outcome in bulk.

The behaviour worth pinning down is the partial result: one mistyped roll
number in a paste of many must not discard the rest, and every roll number that
produced no record has to come back with a reason. Authentication is bypassed by
overriding `get_current_user`, the same seam the resume-upload tests use, so a
token never has to be minted.
"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.dependencies import get_db
from app.models.db import OfferSource, OfferStatus, OfferType, Role

_RECORDER = {
    "sub": "usr_admin",
    "email": "placements@iiitl.ac.in",
    "role": "SUPER_ADMIN",
}


@pytest.fixture()
def client():
    from main import app  # noqa: PLC0415

    with TestClient(app, raise_server_exceptions=False) as test_client:
        test_client.app.dependency_overrides[get_current_user] = lambda: _RECORDER
        yield test_client
        test_client.app.dependency_overrides.clear()


def _student(student_id: str, roll: str, role=Role.STUDENT):
    return SimpleNamespace(
        id=student_id,
        name=f"Student {roll}",
        email=f"{roll.lower()}@iiitl.ac.in",
        rollNumber=roll,
        branch="CSE",
        degree="BTech",
        batch=2027,
        role=role,
    )


def _saved_offer(offer_id: str, student, *, job_title="Associate Engineer"):
    """A row as it comes back from the reload after the commit."""
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=offer_id,
        userId=student.id,
        companyId="cmp_1",
        jobProfileId=None,
        applicationId=None,
        jobTitle=job_title,
        job_profile=None,
        type=OfferType.FTE,
        status=OfferStatus.OFFERED,
        source=OfferSource.ON_CAMPUS,
        batch=2027,
        ctc=1_800_000.0,
        stipend=None,
        location=None,
        offeredAt=now,
        decidedAt=None,
        joiningDate=None,
        remarks=None,
        createdAt=now,
        updatedAt=now,
        user=student,
        company=SimpleNamespace(id="cmp_1", name="Nokia"),
    )


def _install_db(client, *, scalar_results, scalars_results):
    """
    Sequence the database calls the endpoint makes, in order: the company
    lookup, then the roster lookup, the already-recorded lookup, and the
    reload of what was written.
    """
    added: list = []

    async def _fake_db():
        db = AsyncMock()
        db.scalar = AsyncMock(side_effect=list(scalar_results))

        results = []
        for rows in scalars_results:
            result = MagicMock()
            result.all.return_value = rows
            results.append(result)
        db.scalars = AsyncMock(side_effect=results)

        db.add = MagicMock(side_effect=added.append)
        db.commit = AsyncMock()
        yield db

    client.app.dependency_overrides[get_db] = _fake_db
    return added


def _payload(**overrides):
    body = {
        "companyId": "cmp_1",
        "type": "FTE",
        "status": "OFFERED",
        "jobTitle": "Associate Engineer",
        "batch": 2027,
        "ctc": 1_800_000,
        "rollNumbers": ["2023UCS1632"],
    }
    body.update(overrides)
    return body


class TestBulkOfferCreation:
    def test_one_record_is_written_for_each_matched_roll_number(self, client):
        company = SimpleNamespace(id="cmp_1", name="Nokia")
        first = _student("usr_1", "2023UCS1632")
        second = _student("usr_2", "2023UME4018")

        added = _install_db(
            client,
            scalar_results=[company],
            scalars_results=[
                [first, second],  # roster lookup
                [],               # nothing recorded yet
                [_saved_offer("off_1", first), _saved_offer("off_2", second)],
            ],
        )

        res = client.post(
            "/api/v1/offers/bulk",
            json=_payload(rollNumbers=["2023UCS1632", "2023UME4018"]),
        )

        assert res.status_code == 201, res.text
        body = res.json()
        assert body["created"] == 2
        assert body["skipped"] == []
        assert len(added) == 2
        # The shared configuration lands on every row, which is the whole point
        # of the screen.
        assert {offer.jobTitle for offer in added} == {"Associate Engineer"}
        assert {offer.batch for offer in added} == {2027}
        assert {offer.ctc for offer in added} == {1_800_000}

    def test_an_unknown_roll_number_is_reported_and_the_rest_are_written(self, client):
        company = SimpleNamespace(id="cmp_1", name="Nokia")
        known = _student("usr_1", "2023UCS1632")

        added = _install_db(
            client,
            scalar_results=[company],
            scalars_results=[[known], [], [_saved_offer("off_1", known)]],
        )

        res = client.post(
            "/api/v1/offers/bulk",
            json=_payload(rollNumbers=["2023UCS1632", "9999XXX0000"]),
        )

        assert res.status_code == 201, res.text
        body = res.json()
        assert body["created"] == 1
        assert len(added) == 1
        assert body["skipped"] == [
            {"rollNumber": "9999XXX0000", "reason": "No student with this roll number."}
        ]

    def test_a_student_who_already_has_the_record_is_skipped_not_doubled(self, client):
        company = SimpleNamespace(id="cmp_1", name="Nokia")
        student = _student("usr_1", "2023UCS1632")

        added = _install_db(
            client,
            scalar_results=[company],
            scalars_results=[
                [student],
                [SimpleNamespace(userId="usr_1")],  # the same record exists
                [],
            ],
        )

        res = client.post("/api/v1/offers/bulk", json=_payload())

        assert res.status_code == 201, res.text
        body = res.json()
        assert body["created"] == 0
        assert added == []
        assert body["skipped"][0]["reason"] == "Already has this record for the same season."

    def test_a_non_student_account_cannot_hold_a_placement_record(self, client):
        company = SimpleNamespace(id="cmp_1", name="Nokia")
        staff = _student("usr_staff", "2023UCS1632", role=Role.PLACEMENT_TEAM)

        added = _install_db(
            client,
            scalar_results=[company],
            scalars_results=[[staff], [], []],
        )

        res = client.post("/api/v1/offers/bulk", json=_payload())

        assert res.status_code == 201, res.text
        assert res.json()["created"] == 0
        assert added == []
        assert res.json()["skipped"][0]["reason"] == "Not a student account."

    def test_a_repeated_roll_number_writes_one_record(self, client):
        company = SimpleNamespace(id="cmp_1", name="Nokia")
        student = _student("usr_1", "2023UCS1632")

        added = _install_db(
            client,
            scalar_results=[company],
            scalars_results=[[student], [], [_saved_offer("off_1", student)]],
        )

        # Mixed case and a repeat, which is what a spreadsheet column produces.
        res = client.post(
            "/api/v1/offers/bulk",
            json=_payload(rollNumbers=["2023ucs1632", "2023UCS1632", " 2023UCS1632 "]),
        )

        assert res.status_code == 201, res.text
        assert res.json()["created"] == 1
        assert len(added) == 1

    def test_an_unknown_company_is_refused_before_anything_is_written(self, client):
        added = _install_db(client, scalar_results=[None], scalars_results=[])

        res = client.post("/api/v1/offers/bulk", json=_payload())

        assert res.status_code == 400
        assert res.json()["detail"] == "Company not found."
        assert added == []

    def test_the_amount_rule_is_not_looser_in_bulk(self, client):
        _install_db(client, scalar_results=[], scalars_results=[])

        res = client.post("/api/v1/offers/bulk", json=_payload(ctc=None))

        # Rejected by the schema, before the endpoint runs.
        assert res.status_code == 422

    def test_an_accepted_record_is_stamped_as_decided(self, client):
        company = SimpleNamespace(id="cmp_1", name="Nokia")
        student = _student("usr_1", "2023UCS1632")

        added = _install_db(
            client,
            scalar_results=[company],
            scalars_results=[[student], [], [_saved_offer("off_1", student)]],
        )

        res = client.post("/api/v1/offers/bulk", json=_payload(status="ACCEPTED"))

        assert res.status_code == 201, res.text
        assert added[0].status == OfferStatus.ACCEPTED
        assert added[0].decidedAt is not None
