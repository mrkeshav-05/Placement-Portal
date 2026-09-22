"""
Tests for the admin applications list endpoint's search and pagination.

The behaviour worth pinning down: the free-text box has to reach Postgres as
an ILIKE, the same way its sibling export endpoint already does, rather than
filtering rows in a Python loop after they have all been fetched — and the
row count returned to the browser has to stay bounded regardless of how many
applications a season accumulates. Both are checked against the actual
SQLAlchemy `Select` the endpoint builds (captured off the `db.scalars` call)
rather than against real data, the same "inspect the statement" approach the
sibling export endpoint's asymmetry was diagnosed with in the first place.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

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


def _install_capturing_db(client):
    """Hands back an empty result set and remembers the statement it was asked to run."""
    captured: dict = {}

    async def _fake_db():
        db = AsyncMock()

        async def _scalars(stmt):
            captured["stmt"] = stmt
            result = MagicMock()
            result.unique.return_value.all.return_value = []
            return result

        db.scalars = _scalars
        yield db

    client.app.dependency_overrides[get_db] = _fake_db
    return captured


def _compiled(stmt) -> str:
    # Compiled against the real production dialect: the generic compiler
    # (what a bare `.compile()` uses) rewrites `.ilike()` into
    # `lower(x) LIKE lower(...)`, which would make this test pass whether or
    # not Postgres's own case-insensitive operator is actually used.
    return str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def test_search_term_is_pushed_into_sql_as_ilike(client):
    captured = _install_capturing_db(client)

    response = client.get("/api/v1/applications/admin", params={"search": "Acme"})

    assert response.status_code == 200
    sql = _compiled(captured["stmt"])
    assert "ILIKE" in sql
    assert "%Acme%" in sql


def test_no_search_term_omits_ilike(client):
    captured = _install_capturing_db(client)

    response = client.get("/api/v1/applications/admin")

    assert response.status_code == 200
    sql = _compiled(captured["stmt"])
    assert "ILIKE" not in sql


def test_default_result_is_bounded(client):
    """
    Nothing here paginates in the browser yet, so the one thing standing
    between this endpoint and "every application this portal has ever
    recorded" is this LIMIT — it has to be present even when the caller asks
    for nothing in particular.
    """
    captured = _install_capturing_db(client)

    response = client.get("/api/v1/applications/admin")

    assert response.status_code == 200
    sql = _compiled(captured["stmt"])
    assert "LIMIT 500" in sql
    assert "OFFSET 0" in sql


def test_limit_and_offset_are_honoured(client):
    captured = _install_capturing_db(client)

    response = client.get(
        "/api/v1/applications/admin", params={"limit": 50, "offset": 100}
    )

    assert response.status_code == 200
    sql = _compiled(captured["stmt"])
    assert "LIMIT 50" in sql
    assert "OFFSET 100" in sql


def test_limit_is_capped_at_one_thousand(client):
    _install_capturing_db(client)

    response = client.get("/api/v1/applications/admin", params={"limit": 5000})

    assert response.status_code == 422
