"""
Tests for the read-through cache.

Two properties carry the weight here. The first is that a cache miss and a
cache hit are indistinguishable to the caller, including when Redis is absent
or broken — a cache outage is allowed to cost time, never correctness. The
second is that the placement cell's view of the announcements never reaches a
student, which is the one way a cache on this data could leak something.
"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

from app.core import cache
from app.core.config import settings
from app.core.security import get_current_user
from app.dependencies import get_db
from app.models.db import AnnouncementCategory, AnnouncementStatus


class FakeRedis:
    """
    Enough of the client for the two shapes this module uses: a hash per
    topic, and a delete of the whole hash. `fail_with` makes every call raise,
    which is how the Redis-is-down path is exercised without a Redis to stop.
    """

    def __init__(self, fail_with: Exception | None = None):
        self.store: dict[str, dict[str, str]] = {}
        self.expiries: dict[str, int] = {}
        self.fail_with = fail_with
        self.hget_calls = 0

    def _check(self):
        if self.fail_with:
            raise self.fail_with

    async def hget(self, name, field):
        self.hget_calls += 1
        self._check()
        return self.store.get(name, {}).get(field)

    async def delete(self, *names):
        self._check()
        for name in names:
            self.store.pop(name, None)
            self.expiries.pop(name, None)

    def pipeline(self):
        return FakePipeline(self)

    async def aclose(self):
        pass


class FakePipeline:
    def __init__(self, redis: FakeRedis):
        self.redis = redis
        self.queued: list = []

    def hset(self, name, field, value):
        self.queued.append(("hset", name, field, value))
        return self

    def expire(self, name, seconds, nx=False):
        self.queued.append(("expire", name, seconds, nx))
        return self

    async def execute(self):
        self.redis._check()
        for op in self.queued:
            if op[0] == "hset":
                _, name, field, value = op
                self.redis.store.setdefault(name, {})[field] = value
            else:
                _, name, seconds, nx = op
                if nx and name in self.redis.expiries:
                    continue
                self.redis.expiries[name] = seconds
        self.queued.clear()


@pytest.fixture(autouse=True)
def reset_cache_module():
    """The client and the degraded flag are module state; no test may inherit them."""
    yield
    cache._client = None
    cache._client_built = False
    cache._degraded = False


@pytest.fixture()
def fake_redis(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(cache, "_client", redis)
    monkeypatch.setattr(cache, "_client_built", True)
    return redis


class TestKeys:
    def test_the_viewer_is_part_of_the_key(self):
        """
        The leak this cache could cause, pinned down.

        The placement cell's list includes drafts and the student's does not.
        If the two produced the same field, whichever ran first would answer
        for both.
        """
        staff = cache.field_for({"drafts": True, "view": "list", "limit": 20})
        student = cache.field_for({"drafts": False, "view": "list", "limit": 20})
        assert staff != student

    def test_the_same_inputs_give_the_same_field_whatever_order_they_arrive_in(self):
        assert cache.field_for({"a": 1, "b": 2}) == cache.field_for({"b": 2, "a": 1})

    def test_different_filters_give_different_fields(self):
        general = cache.field_for({"category": "GENERAL"})
        event = cache.field_for({"category": "COMPANY_EVENT"})
        assert general != event

    def test_an_unknown_topic_is_refused_rather_than_silently_cached(self):
        """
        A typo in a topic name would otherwise produce a key nothing ever
        invalidates, which is a cache that only ever goes stale.
        """
        with pytest.raises(ValueError, match="Unknown cache topic"):
            cache._topic_key("anouncements")


class TestReadThrough:
    async def test_the_loader_runs_once_and_the_second_read_is_served_from_redis(self, fake_redis):
        calls = []

        async def load():
            calls.append(1)
            return {"rows": [1, 2, 3]}

        key = {"view": "list"}
        first = await cache.get_or_set(cache.TOPIC_EVENTS, key, load)
        second = await cache.get_or_set(cache.TOPIC_EVENTS, key, load)

        assert first == second == {"rows": [1, 2, 3]}
        assert len(calls) == 1

    async def test_a_different_key_is_a_different_answer(self, fake_redis):
        async def load_active():
            return ["active"]

        async def load_all():
            return ["active", "ended"]

        assert await cache.get_or_set(cache.TOPIC_EVENTS, {"activeOnly": True}, load_active) == ["active"]
        assert await cache.get_or_set(cache.TOPIC_EVENTS, {"activeOnly": False}, load_all) == [
            "active",
            "ended",
        ]

    async def test_invalidating_a_topic_sends_the_next_read_back_to_the_loader(self, fake_redis):
        calls = []

        async def load():
            calls.append(1)
            return len(calls)

        key = {"view": "list"}
        assert await cache.get_or_set(cache.TOPIC_EVENTS, key, load) == 1
        assert await cache.get_or_set(cache.TOPIC_EVENTS, key, load) == 1

        await cache.invalidate(cache.TOPIC_EVENTS)

        assert await cache.get_or_set(cache.TOPIC_EVENTS, key, load) == 2

    async def test_invalidating_one_topic_leaves_the_other_alone(self, fake_redis):
        await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 1}, lambda: _value("events"))
        await cache.get_or_set(cache.TOPIC_ANNOUNCEMENTS, {"k": 1}, lambda: _value("announcements"))

        await cache.invalidate(cache.TOPIC_EVENTS)

        assert cache._topic_key(cache.TOPIC_EVENTS) not in fake_redis.store
        assert cache._topic_key(cache.TOPIC_ANNOUNCEMENTS) in fake_redis.store

    async def test_the_expiry_window_runs_from_the_first_write_not_the_latest(self, fake_redis):
        """
        `EXPIRE NX`, so a topic that is read constantly still rebuilds. A
        sliding window would let a busy topic outlive the TTL forever, and the
        TTL is the only thing covering a row changed outside the API.
        """
        await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 1}, lambda: _value("a"))
        await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 2}, lambda: _value("b"))

        name = cache._topic_key(cache.TOPIC_EVENTS)
        assert fake_redis.expiries[name] == settings.cache_ttl_seconds


class TestDegradedRedis:
    async def test_with_no_redis_url_the_loader_answers_every_time(self, monkeypatch):
        monkeypatch.setattr(cache, "_client", None)
        monkeypatch.setattr(cache, "_client_built", True)

        calls = []

        async def load():
            calls.append(1)
            return "from postgres"

        assert await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 1}, load) == "from postgres"
        assert await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 1}, load) == "from postgres"
        assert len(calls) == 2

    async def test_a_redis_that_refuses_connections_does_not_fail_the_request(self, monkeypatch):
        broken = FakeRedis(fail_with=RedisConnectionError("connection refused"))
        monkeypatch.setattr(cache, "_client", broken)
        monkeypatch.setattr(cache, "_client_built", True)

        result = await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 1}, lambda: _value("rows"))

        assert result == "rows"

    async def test_invalidating_against_a_broken_redis_is_not_an_error(self, monkeypatch):
        """
        The write it follows has already committed. Raising here would report
        a successful write as failed.
        """
        broken = FakeRedis(fail_with=RedisConnectionError("connection refused"))
        monkeypatch.setattr(cache, "_client", broken)
        monkeypatch.setattr(cache, "_client_built", True)

        await cache.invalidate(cache.TOPIC_EVENTS, cache.TOPIC_ANNOUNCEMENTS)

    async def test_a_value_json_cannot_hold_is_still_returned_to_the_caller(self, fake_redis):
        """Caching is best-effort; the caller's result is not."""
        unserialisable = {"when": object()}

        result = await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 1}, lambda: _value(unserialisable))

        assert result is unserialisable

    async def test_an_unreadable_entry_is_replaced_rather_than_raised(self, fake_redis):
        name = cache._topic_key(cache.TOPIC_EVENTS)
        field = cache.field_for({"k": 1})
        fake_redis.store[name] = {field: "{not json"}

        result = await cache.get_or_set(cache.TOPIC_EVENTS, {"k": 1}, lambda: _value("rebuilt"))

        assert result == "rebuilt"
        assert fake_redis.store[name][field] == '"rebuilt"'


async def _value(value):
    return value


# ---------------------------------------------------------------------------
# The endpoint, where the visibility rule actually has to hold
# ---------------------------------------------------------------------------

_STAFF = {"sub": "usr_admin", "email": "placements@iiitl.ac.in", "role": "SUPER_ADMIN"}
_STUDENT = {"sub": "usr_student", "email": "student@iiitl.ac.in", "role": "STUDENT"}


def _announcement(announcement_id: str, title: str, status: AnnouncementStatus):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=announcement_id,
        title=title,
        content="Body text",
        category=AnnouncementCategory.GENERAL,
        status=status,
        tags=[],
        companyId=None,
        company=None,
        jobProfileId=None,
        job_profile=None,
        createdById="usr_admin",
        created_by=SimpleNamespace(id="usr_admin", name="Cell", email="cell@iiitl.ac.in"),
        attachments=[],
        publishedAt=now,
        createdAt=now,
        updatedAt=now,
    )


@pytest.fixture()
def client():
    from main import app  # noqa: PLC0415

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
        test_client.app.dependency_overrides.clear()


def _install_rows(client, batches):
    """
    Hand out one batch of rows per query, across the whole test.

    The sequence is shared by every request rather than rebuilt per request,
    which is what makes "this was answered from the cache" observable: a
    second query with nothing left to return raises StopIteration instead of
    quietly replaying the first batch.
    """
    results = []
    for rows in batches:
        result = MagicMock()
        result.all.return_value = rows
        results.append(result)
    remaining = iter(results)

    async def _fake_db():
        db = AsyncMock()
        db.scalars = AsyncMock(side_effect=lambda *a, **kw: next(remaining))
        db.commit = AsyncMock()
        yield db

    client.app.dependency_overrides[get_db] = _fake_db


class TestDraftVisibility:
    """
    The gate the cache key depends on. If this is wrong, keying by it is
    keying by a constant.
    """

    def test_a_student_may_not_see_drafts_despite_holding_announcements_view(self):
        """
        `announcements.view` is in STUDENT_SCOPED_PERMISSIONS, because it is
        what lets a student read the published notices on their dashboard.
        Testing it alone therefore admits every student, which is what this
        guards against.
        """
        from app.core.security import PERM_ANNOUNCEMENTS_VIEW, has_permission  # noqa: PLC0415
        from app.routers.announcements import _may_see_drafts  # noqa: PLC0415

        assert has_permission(_STUDENT, PERM_ANNOUNCEMENTS_VIEW)
        assert not _may_see_drafts(_STUDENT)

    def test_the_placement_cell_may_see_drafts(self):
        from app.routers.announcements import _may_see_drafts  # noqa: PLC0415

        assert _may_see_drafts(_STAFF)
        assert _may_see_drafts({"sub": "u", "email": "vol@iiitl.ac.in", "role": "PLACEMENT_TEAM"})


class TestAnnouncementVisibilityUnderCache:
    def test_a_student_does_not_receive_the_cached_list_built_for_the_placement_cell(
        self, client, fake_redis
    ):
        """
        The whole reason the viewer is in the cache key.

        Staff ask first and their answer, drafts included, goes into Redis. The
        student's request that follows has to miss and run its own query, not
        be handed what is already sitting there under the same URL.
        """
        draft = _announcement("a_draft", "Unpublished", AnnouncementStatus.DRAFT)
        published = _announcement("a_pub", "Published", AnnouncementStatus.PUBLISHED)

        _install_rows(client, [[draft, published], [published]])

        client.app.dependency_overrides[get_current_user] = lambda: _STAFF
        staff_view = client.get("/api/v1/announcements")
        assert staff_view.status_code == 200
        assert {row["id"] for row in staff_view.json()} == {"a_draft", "a_pub"}

        client.app.dependency_overrides[get_current_user] = lambda: _STUDENT
        student_view = client.get("/api/v1/announcements")
        assert student_view.status_code == 200
        assert {row["id"] for row in student_view.json()} == {"a_pub"}

        # Two entries, not one overwritten: the audiences are cached apart.
        assert len(fake_redis.store[cache._topic_key(cache.TOPIC_ANNOUNCEMENTS)]) == 2

    def test_a_repeated_request_from_the_same_audience_is_served_from_the_cache(
        self, client, fake_redis
    ):
        """One batch of rows is installed, so a second query would raise StopIteration."""
        published = _announcement("a_pub", "Published", AnnouncementStatus.PUBLISHED)
        _install_rows(client, [[published]])

        client.app.dependency_overrides[get_current_user] = lambda: _STUDENT

        first = client.get("/api/v1/announcements")
        second = client.get("/api/v1/announcements")

        assert first.status_code == second.status_code == 200
        assert first.json() == second.json()

    def test_a_search_is_not_cached(self, client, fake_redis):
        """
        Two identical searches each run a query. Search terms are typed once,
        so caching them would evict the lists every page load depends on.
        """
        published = _announcement("a_pub", "Published", AnnouncementStatus.PUBLISHED)
        _install_rows(client, [[published], [published]])

        client.app.dependency_overrides[get_current_user] = lambda: _STUDENT

        assert client.get("/api/v1/announcements?search=drive").status_code == 200
        assert client.get("/api/v1/announcements?search=drive").status_code == 200

        assert cache._topic_key(cache.TOPIC_ANNOUNCEMENTS) not in fake_redis.store


class TestInvalidationEndpoint:
    def test_every_topic_can_be_named_by_a_caller_who_may_change_it(self):
        """
        A topic with no permission mapped to it would be refused with a 400 at
        runtime, long after the cache stopped being invalidated.
        """
        from app.routers.cache import _PERMISSION_FOR_TOPIC  # noqa: PLC0415

        assert set(_PERMISSION_FOR_TOPIC) == set(cache.TOPICS)

    def test_a_student_may_not_clear_the_cache(self, client, fake_redis):
        client.app.dependency_overrides[get_current_user] = lambda: _STUDENT

        res = client.post("/api/v1/cache/invalidate", json={"topics": ["events"]})

        assert res.status_code == 403

    def test_an_unknown_topic_is_rejected(self, client, fake_redis):
        client.app.dependency_overrides[get_current_user] = lambda: _STAFF

        res = client.post("/api/v1/cache/invalidate", json={"topics": ["students"]})

        assert res.status_code == 400

    def test_the_placement_cell_can_clear_what_it_changed(self, client, fake_redis):
        name = cache._topic_key(cache.TOPIC_EVENTS)
        fake_redis.store[name] = {"field": '"stale"'}

        client.app.dependency_overrides[get_current_user] = lambda: _STAFF
        res = client.post("/api/v1/cache/invalidate", json={"topics": ["events"]})

        assert res.status_code == 202
        assert name not in fake_redis.store
