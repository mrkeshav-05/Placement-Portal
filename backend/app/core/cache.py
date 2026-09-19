"""
Read-through cache for the handful of queries every signed-in page repeats.

Three properties shape everything here.

It is optional. Postgres remains the only source of truth, and every function
falls back to the loader it was given when Redis is absent, unreachable, or
slow. A cache outage must cost latency, never correctness and never an error
page, so the failure path is the same code path as `REDIS_URL=""`.

It is keyed by what the *viewer* may see, not only by the query string. An
announcement list computed for the placement cell contains drafts, and the
same URL asked by a student must not be answered from it. `key` therefore
carries the viewer's visibility alongside the filters — see `get_or_set`.

It is invalidated by topic, not by key. One Redis hash holds every cached
answer for a topic, so dropping the topic is a single `DELETE` with no key
scanning and no chance of missing a combination of filters. Writes invalidate
explicitly; the TTL is only a backstop for rows changed outside the API.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any, TypeVar

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Topics. A topic is the unit of invalidation: everything under one is dropped
# together, so they are coarse on purpose. Adding a fourth means deciding what
# writes must drop it, which is why they are named here rather than passed as
# free strings from the routers.
TOPIC_ANNOUNCEMENTS = "announcements"
TOPIC_EVENTS = "events"

TOPICS = frozenset({TOPIC_ANNOUNCEMENTS, TOPIC_EVENTS})

_KEY_PREFIX = "tnp:cache"

# A cache read sits in front of a query that usually takes single-digit
# milliseconds, so a Redis that has stopped answering must be abandoned fast
# rather than waited on. Anything above this and the cache would be slower
# than the database it is standing in front of.
_TIMEOUT_SECONDS = 0.25

_client: Redis | None = None
_client_built = False

# Redis going down would otherwise log once per request. The transitions are
# what matter, so each one is logged and the steady state is silent.
_degraded = False


def _get_client() -> Redis | None:
    """The shared client, or None when caching is switched off."""
    global _client, _client_built

    if _client_built:
        return _client

    _client_built = True
    if not settings.redis_url:
        logger.info("REDIS_URL is not set, so announcement and event reads go to Postgres every time.")
        _client = None
        return None

    _client = Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_timeout=_TIMEOUT_SECONDS,
        socket_connect_timeout=_TIMEOUT_SECONDS,
        # A retry doubles the delay a sick Redis adds to a request, and the
        # fallback to Postgres is already correct, so failing once is better.
        retry_on_timeout=False,
    )
    return _client


def _note_failure(operation: str, error: Exception) -> None:
    global _degraded
    if not _degraded:
        _degraded = True
        logger.warning(
            "Cache unavailable during %s (%s). Reads fall through to Postgres until it returns.",
            operation,
            error,
        )


def _note_success() -> None:
    global _degraded
    if _degraded:
        _degraded = False
        logger.info("Cache is answering again.")


def _topic_key(topic: str) -> str:
    if topic not in TOPICS:
        raise ValueError(f"Unknown cache topic {topic!r}. Known topics: {sorted(TOPICS)}")
    return f"{_KEY_PREFIX}:{topic}"


def field_for(key: Mapping[str, Any]) -> str:
    """
    A stable field name for one combination of inputs.

    Hashed rather than concatenated because the inputs include free text: a
    search term containing the separator would otherwise collide with a
    different pair of values. Sorted keys make the digest independent of the
    order the caller happened to build the mapping in.
    """
    canonical = json.dumps(key, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:32]


async def get_or_set(
    topic: str,
    key: Mapping[str, Any],
    loader: Callable[[], Awaitable[T]],
    *,
    ttl: int | None = None,
) -> T:
    """
    Return the cached answer for `key`, or run `loader` and cache what it gives.

    `key` must name every input that changes the answer, **including who is
    asking** whenever the answer depends on it. Two callers whose results may
    differ and whose keys match will be served each other's data; for these
    topics that means a student reading the placement cell's drafts. Routers
    pass a `drafts` or equivalent flag for exactly this reason.

    `loader` must return something `json.dumps` accepts, which in practice
    means `model_dump(mode="json")` rather than the Pydantic model itself.
    FastAPI validates the plain structure back into the response model, so a
    hit and a miss return the same shape.
    """
    client = _get_client()
    if client is None:
        return await loader()

    name = _topic_key(topic)
    field = field_for(key)

    try:
        hit = await client.hget(name, field)
        _note_success()
        if hit is not None:
            return json.loads(hit)
    except (RedisError, OSError) as error:
        _note_failure("read", error)
        return await loader()
    except json.JSONDecodeError:
        # Something wrote a value this code cannot read. Treat it as a miss and
        # overwrite it below rather than failing the request.
        logger.warning("Discarding an unreadable cache entry under %s.", name)

    value = await loader()

    try:
        pipe = client.pipeline()
        pipe.hset(name, field, json.dumps(value, default=str))
        # NX, so the window runs from the first write rather than the most
        # recent one. A sliding expiry would let a busy topic outlive its TTL
        # indefinitely, which is the one thing the backstop exists to prevent.
        pipe.expire(name, ttl or settings.cache_ttl_seconds, nx=True)
        await pipe.execute()
        _note_success()
    except (RedisError, OSError, TypeError) as error:
        # TypeError is a value json refused; logged and skipped, because the
        # caller's result is still correct and returning it matters more.
        _note_failure("write", error)

    return value


async def invalidate(*topics: str) -> None:
    """
    Drop every cached answer for these topics.

    Called after a write, and safe to call when nothing is cached. Failure is
    logged rather than raised: a write that succeeded in Postgres must not be
    reported as failed because the cache would not let go of the old copy, and
    the TTL bounds how long that copy can survive.
    """
    client = _get_client()
    if client is None:
        return

    names = [_topic_key(topic) for topic in topics]
    if not names:
        return

    try:
        await client.delete(*names)
        _note_success()
    except (RedisError, OSError) as error:
        _note_failure("invalidate", error)


async def close() -> None:
    """Release the connection pool at shutdown."""
    global _client, _client_built, _degraded

    if _client is not None:
        try:
            await _client.aclose()
        except (RedisError, OSError):
            pass

    _client = None
    _client_built = False
    _degraded = False
