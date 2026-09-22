"""
Tests for caching the placement analytics overview.

The one thing worth pinning down here is the wiring itself: that the season's
worth of offer/funnel aggregation actually goes through `cache.get_or_set`
under the analytics topic, keyed by the season being asked for — not that the
cache module's own hit/miss/degraded-Redis behaviour holds, which
`test_cache.py` already covers for the sibling announcements/events topics
and does not depend on which router is calling it.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core import cache
from app.core.security import get_current_user
from app.dependencies import get_db

_ADMIN = {
    "sub": "usr_admin",
    "email": "placements@iiitl.ac.in",
    "role": "SUPER_ADMIN",
}


@pytest.fixture()
def client():
    from main import app  # noqa: PLC0415

    with TestClient(app, raise_server_exceptions=False) as test_client:
        test_client.app.dependency_overrides[get_current_user] = lambda: _ADMIN
        yield test_client
        test_client.app.dependency_overrides.clear()


def _install_db_for_overview(client, *, season: int):
    """
    Enough of a fake session for `admin_overview` to reach `cache.get_or_set`:
    one season on file, and zero rows everywhere else, so the loader itself
    (exercised only on a cache miss) has nothing to iterate.
    """

    async def _fake_db():
        db = AsyncMock()

        async def _scalars(stmt):
            result = MagicMock()
            result.all.return_value = []
            result.unique.return_value.all.return_value = []
            return result

        async def _scalar(stmt):
            return 0

        db.scalars = _scalars
        db.scalar = _scalar
        db.execute = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))
        yield db

    client.app.dependency_overrides[get_db] = _fake_db


def test_overview_is_read_through_the_analytics_topic(client, monkeypatch):
    calls: list[tuple[str, dict]] = []
    canned = {"season": 2027, "seasons": [2027], "totals": {}, "packages": {}}

    async def _fake_get_or_set(topic, key, loader, **kwargs):
        calls.append((topic, dict(key)))
        return canned

    monkeypatch.setattr(cache, "get_or_set", _fake_get_or_set)
    _install_db_for_overview(client, season=2027)

    response = client.get("/api/v1/analytics/admin/overview", params={"batch": 2027})

    assert response.status_code == 200
    assert response.json() == canned
    assert calls == [(cache.TOPIC_ANALYTICS, {"season": 2027})]


def test_different_seasons_are_different_cache_entries(client, monkeypatch):
    seen_keys: list[dict] = []

    async def _fake_get_or_set(topic, key, loader, **kwargs):
        seen_keys.append(dict(key))
        return await loader()

    monkeypatch.setattr(cache, "get_or_set", _fake_get_or_set)
    _install_db_for_overview(client, season=2027)

    client.get("/api/v1/analytics/admin/overview", params={"batch": 2027})
    client.get("/api/v1/analytics/admin/overview", params={"batch": 2028})

    assert seen_keys == [{"season": 2027}, {"season": 2028}]
