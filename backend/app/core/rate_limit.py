"""
Redis-backed attempt throttle for endpoints with no per-user session to key
on: the `/admin` table-browser login and the identity-document unlock
challenge. Both currently have no limit on repeated attempts at all.

Same shape as `frontend/src/lib/rate-limit.ts`'s `createThrottle`: N attempts
inside a window locks a key out for a separate duration. It shares this
service's own Redis connection settings with the read-through cache
(`app.core.cache`) but keeps its own client, because a throttle and a cache
fail toward opposite defaults — a cache miss falls through to the correct,
slower answer, but a throttle has no "slower but still correct" path when it
cannot be read, so it fails open instead: an unreachable or unconfigured
Redis makes every check report "not locked out" and every write a no-op.
Refusing sign-in because Redis is unreachable would turn one incident into
two, and the alternative, blocking nothing, is the same bet `cache.py`
already makes for reads.
"""

from __future__ import annotations

import logging

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 0.25
_KEY_PREFIX = "tnp:throttle"

_client: Redis | None = None
_client_built = False


def _get_client() -> Redis | None:
    global _client, _client_built

    if _client_built:
        return _client

    _client_built = True
    if not settings.redis_url:
        logger.info("REDIS_URL is not set, so login/unlock throttling is disabled.")
        _client = None
        return None

    _client = Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_timeout=_TIMEOUT_SECONDS,
        socket_connect_timeout=_TIMEOUT_SECONDS,
        retry_on_timeout=False,
    )
    return _client


class Throttle:
    """
    One named, independently-configured throttle. `name` namespaces its keys
    so several throttles can share the one Redis without colliding.
    """

    def __init__(self, name: str, *, window_seconds: int, lockout_seconds: int, max_attempts: int) -> None:
        self._name = name
        self._window_seconds = window_seconds
        self._lockout_seconds = lockout_seconds
        self._max_attempts = max_attempts

    def _count_key(self, key: str) -> str:
        return f"{_KEY_PREFIX}:{self._name}:count:{key}"

    def _lock_key(self, key: str) -> str:
        return f"{_KEY_PREFIX}:{self._name}:lock:{key}"

    async def is_locked_out(self, key: str) -> bool:
        client = _get_client()
        if client is None:
            return False
        try:
            return bool(await client.exists(self._lock_key(key)))
        except (RedisError, OSError) as error:
            logger.warning(
                "Throttle %r unreachable during a lockout check (%s); treating as not locked out.",
                self._name,
                error,
            )
            return False

    async def record_attempt(self, key: str) -> None:
        """Counts one attempt toward the window, locking the key out once `max_attempts` is reached."""
        client = _get_client()
        if client is None:
            return
        try:
            count_key = self._count_key(key)
            pipe = client.pipeline()
            pipe.incr(count_key)
            # NX, so the window runs from the first attempt rather than the
            # most recent one — the same reasoning as cache.py's expire(nx=True).
            pipe.expire(count_key, self._window_seconds, nx=True)
            count, _ = await pipe.execute()
            if count >= self._max_attempts:
                await client.set(self._lock_key(key), "1", ex=self._lockout_seconds)
                await client.delete(count_key)
        except (RedisError, OSError) as error:
            logger.warning(
                "Throttle %r unreachable while recording an attempt (%s); this attempt was not counted.",
                self._name,
                error,
            )

    async def clear(self, key: str) -> None:
        """Called on success, so a legitimate sign-in or unlock is not penalised by earlier mistakes."""
        client = _get_client()
        if client is None:
            return
        try:
            await client.delete(self._count_key(key), self._lock_key(key))
        except (RedisError, OSError) as error:
            logger.warning("Throttle %r unreachable while clearing %r (%s).", self._name, key, error)
