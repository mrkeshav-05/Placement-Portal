"""
Tests for the Redis-backed attempt throttle behind the /admin login and the
identity-document unlock challenge.

Two properties carry the weight here, the same two as test_cache.py: an
unreachable or unconfigured Redis must never turn into a request failure
(it fails open instead, the opposite direction from the cache, which is the
whole reason this is a separate module rather than reusing cache.py), and a
key locks out only once, not on every attempt after the threshold.
"""
from __future__ import annotations

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from app.core import rate_limit
from app.core.rate_limit import Throttle


class FakeRedis:
    """Enough of the client for a counter with an NX expiry, a lock key, and a delete. `fail_with` simulates an outage."""

    def __init__(self, fail_with: Exception | None = None):
        self.counts: dict[str, int] = {}
        self.count_has_expiry: set[str] = set()
        self.locks: dict[str, str] = {}
        self.fail_with = fail_with

    def _check(self):
        if self.fail_with:
            raise self.fail_with

    async def exists(self, key):
        self._check()
        return 1 if key in self.locks else 0

    async def set(self, key, value, ex=None):
        self._check()
        self.locks[key] = value

    async def delete(self, *keys):
        self._check()
        removed = 0
        for key in keys:
            if self.counts.pop(key, None) is not None:
                removed += 1
            self.count_has_expiry.discard(key)
            if self.locks.pop(key, None) is not None:
                removed += 1
        return removed

    def pipeline(self):
        return FakePipeline(self)


class FakePipeline:
    def __init__(self, redis: FakeRedis):
        self.redis = redis
        self.queued: list = []

    def incr(self, key):
        self.queued.append(("incr", key))
        return self

    def expire(self, key, seconds, nx=False):
        self.queued.append(("expire", key, seconds, nx))
        return self

    async def execute(self):
        self.redis._check()
        results = []
        for op in self.queued:
            if op[0] == "incr":
                _, key = op
                self.redis.counts[key] = self.redis.counts.get(key, 0) + 1
                results.append(self.redis.counts[key])
            else:
                _, key, seconds, nx = op
                if nx and key in self.redis.count_has_expiry:
                    results.append(0)
                else:
                    self.redis.count_has_expiry.add(key)
                    results.append(1)
        self.queued.clear()
        return results


@pytest.fixture(autouse=True)
def reset_rate_limit_module():
    """The client is module state; no test may inherit another's."""
    yield
    rate_limit._client = None
    rate_limit._client_built = False


@pytest.fixture()
def fake_redis(monkeypatch):
    redis = FakeRedis()
    monkeypatch.setattr(rate_limit, "_client", redis)
    monkeypatch.setattr(rate_limit, "_client_built", True)
    return redis


class TestThrottle:
    async def test_stays_unlocked_below_the_threshold(self, fake_redis):
        throttle = Throttle("t", window_seconds=900, lockout_seconds=900, max_attempts=3)
        await throttle.record_attempt("addr")
        await throttle.record_attempt("addr")
        assert await throttle.is_locked_out("addr") is False

    async def test_locks_out_once_max_attempts_is_reached(self, fake_redis):
        throttle = Throttle("t", window_seconds=900, lockout_seconds=900, max_attempts=3)
        for _ in range(3):
            await throttle.record_attempt("addr")
        assert await throttle.is_locked_out("addr") is True

    async def test_clear_lifts_a_lock_and_resets_the_count(self, fake_redis):
        throttle = Throttle("t", window_seconds=900, lockout_seconds=900, max_attempts=2)
        await throttle.record_attempt("addr")
        await throttle.record_attempt("addr")
        assert await throttle.is_locked_out("addr") is True

        await throttle.clear("addr")
        assert await throttle.is_locked_out("addr") is False

        # The count was reset too, not just the lock: it takes a fresh
        # max_attempts to lock out again, not one.
        await throttle.record_attempt("addr")
        assert await throttle.is_locked_out("addr") is False

    async def test_keys_are_throttled_independently(self, fake_redis):
        throttle = Throttle("t", window_seconds=900, lockout_seconds=900, max_attempts=2)
        await throttle.record_attempt("attacker-ip")
        await throttle.record_attempt("attacker-ip")
        assert await throttle.is_locked_out("attacker-ip") is True
        assert await throttle.is_locked_out("someone-else-ip") is False

    async def test_two_throttles_sharing_one_redis_do_not_collide(self, fake_redis):
        login = Throttle("db-admin-login", window_seconds=900, lockout_seconds=900, max_attempts=2)
        unlock = Throttle("identity-doc-unlock", window_seconds=900, lockout_seconds=900, max_attempts=2)
        await login.record_attempt("same-key")
        await login.record_attempt("same-key")
        assert await login.is_locked_out("same-key") is True
        assert await unlock.is_locked_out("same-key") is False


class TestDegradedRedis:
    async def test_with_no_redis_configured_nothing_is_ever_locked_out(self, monkeypatch):
        monkeypatch.setattr(rate_limit, "_client", None)
        monkeypatch.setattr(rate_limit, "_client_built", True)

        throttle = Throttle("t", window_seconds=900, lockout_seconds=900, max_attempts=1)
        await throttle.record_attempt("addr")
        assert await throttle.is_locked_out("addr") is False

    async def test_a_redis_that_refuses_connections_fails_open(self, monkeypatch):
        broken = FakeRedis(fail_with=RedisConnectionError("connection refused"))
        monkeypatch.setattr(rate_limit, "_client", broken)
        monkeypatch.setattr(rate_limit, "_client_built", True)

        throttle = Throttle("t", window_seconds=900, lockout_seconds=900, max_attempts=1)
        # Neither call may raise: a login or an unlock must still succeed
        # or fail on its own merits while the throttle itself is unreachable.
        await throttle.record_attempt("addr")
        assert await throttle.is_locked_out("addr") is False

    async def test_clearing_against_a_broken_redis_is_not_an_error(self, monkeypatch):
        broken = FakeRedis(fail_with=RedisConnectionError("connection refused"))
        monkeypatch.setattr(rate_limit, "_client", broken)
        monkeypatch.setattr(rate_limit, "_client_built", True)

        throttle = Throttle("t", window_seconds=900, lockout_seconds=900, max_attempts=1)
        await throttle.clear("addr")
