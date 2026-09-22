"""
Placement analytics for the admin dashboard.

Every figure here is scoped to one season (the graduating batch year) and
aggregated on the server, so the dashboard page renders a response rather than
running a dozen queries of its own.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import cache
from app.core.security import PERM_ANALYTICS_VIEW, require_permission
from app.dependencies import get_db
from app.models.db import (
    Application,
    ApplicationStatus,
    Company,
    JobProfile,
    JobStatus,
    Offer,
    OfferType,
    Role,
    User,
)
from app.services.placement_stats import (
    COUNTED_OFFER_STATUSES,
    PLACEMENT_TYPES,
    AmountStats,
    counts_by_label,
    placement_rate,
    summarize_amounts,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _stats_payload(stats: AmountStats) -> dict:
    return {
        "count": stats.count,
        "average": stats.average,
        "median": stats.median,
        "highest": stats.highest,
        "lowest": stats.lowest,
    }


def _distribution(labels) -> list[dict]:
    return [{"label": label, "count": count} for label, count in counts_by_label(labels)]


@router.get("/seasons", response_model=list[int])
async def list_seasons(
    caller: dict = Depends(require_permission(PERM_ANALYTICS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """
    Seasons worth selecting: any batch that has an offer, a drive, or a
    student on file. Newest first, because that is the one being worked on.
    """
    offer_batches = (await db.scalars(select(Offer.batch).distinct())).all()
    job_batches = (await db.scalars(select(JobProfile.batch).distinct())).all()
    student_batches = (
        await db.scalars(
            select(User.batch).distinct().where(User.role == Role.STUDENT, User.batch.isnot(None))
        )
    ).all()
    return sorted({*offer_batches, *job_batches, *student_batches}, reverse=True)


@router.get("/admin/overview")
async def admin_overview(
    batch: Optional[int] = Query(None, description="Placement season; defaults to the newest"),
    caller: dict = Depends(require_permission(PERM_ANALYTICS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    seasons = await list_seasons(caller=caller, db=db)
    # Without an explicit choice, open on the newest season that has results.
    # The newest season overall is usually next year's batch, whose drives have
    # not run yet, and an empty dashboard is not what the office wants to see.
    offer_seasons = sorted((await db.scalars(select(Offer.batch).distinct())).all(), reverse=True)
    season = batch or (offer_seasons[0] if offer_seasons else (seasons[0] if seasons else None))

    # Portal-wide totals. These do not belong to a season: they describe the
    # register, not the year's results.
    total_students = await db.scalar(
        select(func.count(User.id)).where(User.role == Role.STUDENT)
    )
    total_companies = await db.scalar(select(func.count(Company.id)))
    active_jobs = await db.scalar(
        select(func.count(JobProfile.id)).where(JobProfile.status == JobStatus.ACTIVE)
    )

    if season is None:
        return {
            "season": None,
            "seasons": [],
            "totals": {
                "students": total_students or 0,
                "seasonStudents": 0,
                "companies": total_companies or 0,
                "activeJobs": active_jobs or 0,
                "placements": 0,
                "internships": 0,
                "placedStudents": 0,
                "placementRate": 0,
                "recruiters": 0,
            },
            "packages": {
                key: _stats_payload(summarize_amounts([]))
                for key in ("placement", "ppo", "combined", "internship")
            },
            "placementsByDegree": [],
            "internshipsByDegree": [],
            "placementsByBranch": [],
            "topRecruiters": [],
            "applicationFunnel": {"total": 0, "shortlisted": 0, "interviews": 0, "selected": 0},
            "recentApplications": [],
        }

    async def load() -> dict:
        season_students = await db.scalar(
            select(func.count(User.id)).where(User.role == Role.STUDENT, User.batch == season)
        )

        offers = (
            await db.scalars(
                select(Offer)
                .options(selectinload(Offer.user), selectinload(Offer.company))
                .where(Offer.batch == season, Offer.status.in_(COUNTED_OFFER_STATUSES))
            )
        ).all()

        placements = [o for o in offers if o.type in PLACEMENT_TYPES]
        internships = [o for o in offers if o.type == OfferType.INTERNSHIP]
        fte = [o for o in placements if o.type == OfferType.FTE]
        ppo = [o for o in placements if o.type == OfferType.PPO]

        placed_students = {o.userId for o in placements}

        return {
            "season": season,
            "seasons": seasons,
            "totals": {
                "students": total_students or 0,
                "seasonStudents": season_students or 0,
                "companies": total_companies or 0,
                "activeJobs": active_jobs or 0,
                "placements": len(placements),
                "internships": len(internships),
                "placedStudents": len(placed_students),
                "placementRate": placement_rate(len(placed_students), season_students or 0),
                "recruiters": len({o.companyId for o in offers}),
            },
            "packages": {
                "placement": _stats_payload(summarize_amounts(o.ctc for o in fte)),
                "ppo": _stats_payload(summarize_amounts(o.ctc for o in ppo)),
                "combined": _stats_payload(summarize_amounts(o.ctc for o in placements)),
                "internship": _stats_payload(summarize_amounts(o.stipend for o in internships)),
            },
            "placementsByDegree": _distribution(
                o.user.degree if o.user else None for o in placements
            ),
            "internshipsByDegree": _distribution(
                o.user.degree if o.user else None for o in internships
            ),
            "placementsByBranch": _distribution(
                o.user.branch if o.user else None for o in placements
            ),
            "topRecruiters": [
                {"label": label, "count": count}
                for label, count in counts_by_label(
                    o.company.name if o.company else None for o in offers
                )[:8]
            ],
            "applicationFunnel": await _funnel(db, season),
            "recentApplications": await _recent_applications(db, season),
        }

    # Every input here is bounded to one season (hundreds of rows, not the
    # whole table), so the win from caching is avoiding the repeat work on
    # every dashboard load/refresh, not bounding an unbounded query the way
    # the admin applications list needed. Keyed by season alone: the response
    # is the same for every caller who holds `analytics.view`, admin or
    # student, so there is no viewer dimension to add to the key.
    return await cache.get_or_set(cache.TOPIC_ANALYTICS, {"season": season}, load)


async def _funnel(db: AsyncSession, season: int) -> dict:
    rows = (
        await db.execute(
            select(Application.status, func.count(Application.id))
            .join(Application.job_profile)
            .where(JobProfile.batch == season)
            .group_by(Application.status)
        )
    ).all()
    counts = {status: count for status, count in rows}

    def value(status: ApplicationStatus) -> int:
        return counts.get(status, 0)

    return {
        "total": sum(counts.values()),
        "shortlisted": value(ApplicationStatus.SHORTLISTED),
        "interviews": value(ApplicationStatus.INTERVIEW),
        "selected": value(ApplicationStatus.SELECTED),
    }


async def _recent_applications(db: AsyncSession, season: int) -> list[dict]:
    applications = (
        await db.scalars(
            select(Application)
            .options(
                selectinload(Application.user),
                selectinload(Application.job_profile).selectinload(JobProfile.company),
            )
            .join(Application.job_profile)
            .where(JobProfile.batch == season)
            .order_by(Application.updatedAt.desc())
            .limit(8)
        )
    ).all()

    return [
        {
            "id": a.id,
            "student": (a.user.name if a.user else None) or (a.user.rollNumber if a.user else None) or "Student",
            "role": a.job_profile.title if a.job_profile else "",
            "company": a.job_profile.company.name if a.job_profile and a.job_profile.company else "",
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            "updatedAt": a.updatedAt.isoformat() if a.updatedAt else None,
        }
        for a in applications
    ]
