"""
Lets a writer outside this process drop what it just made stale.

Announcements and events are cached here, but not every write to them happens
here: the admin screens still change job profiles, and can fall back to
changing announcements, through Prisma in the Next.js process. That writer has
no way to reach this cache, so without this endpoint a published drive would
sit behind the old list until the TTL ran out.

The frontend names a topic and nothing else. Key layout, hashing and the
choice of what a topic covers stay in `app.core.cache`, so the two services
cannot drift into disagreeing about what a key looks like. Remove this once
those writes have moved to the API, which is the direction the data layer is
already heading.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core import cache
from app.core.security import (
    PERM_ANNOUNCEMENTS_UPDATE,
    PERM_JOBS_UPDATE,
    PERM_PLACEMENT_RECORDS_UPDATE,
    get_current_user,
    has_permission,
)

router = APIRouter(prefix="/cache", tags=["cache"])

# Dropping a topic costs a rebuild from Postgres, so the bar is "may change
# this data", not "is an administrator": the same people whose writes create
# the staleness are the ones who may clear it.
_PERMISSION_FOR_TOPIC = {
    cache.TOPIC_ANNOUNCEMENTS: PERM_ANNOUNCEMENTS_UPDATE,
    cache.TOPIC_EVENTS: PERM_JOBS_UPDATE,
    # The backend's own offer/application writes already invalidate this
    # directly (see offers.py, applications.py); this entry exists for the
    # Prisma-side write this cache can't otherwise see — a job's status
    # flipping, which moves `activeJobs` in the same overview.
    cache.TOPIC_ANALYTICS: PERM_PLACEMENT_RECORDS_UPDATE,
}


class CacheInvalidateRequest(BaseModel):
    topics: list[str] = Field(..., min_length=1, max_length=len(_PERMISSION_FOR_TOPIC))


@router.post("/invalidate", status_code=status.HTTP_202_ACCEPTED)
async def invalidate_topics(
    data: CacheInvalidateRequest,
    caller: dict = Depends(get_current_user),
):
    """Drop every cached answer for the named topics."""
    topics = sorted(set(data.topics))

    for topic in topics:
        permission = _PERMISSION_FOR_TOPIC.get(topic)
        if permission is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown cache topic {topic!r}.",
            )
        if not has_permission(caller, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You may not clear the {topic} cache.",
            )

    await cache.invalidate(*topics)
    return {"invalidated": topics}
