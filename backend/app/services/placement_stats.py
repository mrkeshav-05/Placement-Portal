"""
Aggregation rules behind the placement dashboard.

Kept out of the router so the arithmetic is testable on its own and so there is
one answer to "which offers count", rather than one per query.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Optional

from app.models.db import OfferStatus, OfferType, PpoStatus

# A REVOKED offer never stood and a DECLINED one was given up, so neither is
# part of the season's placement record. Both rows stay in the table: the
# office still needs to see them on the placement-records screen.
COUNTED_OFFER_STATUSES = (OfferStatus.OFFERED, OfferStatus.ACCEPTED)

# A PPO is a placement: the student converted an internship into a full-time
# role. It is reported separately as well, because the office tracks the
# conversion rate.
PLACEMENT_TYPES = (OfferType.FTE, OfferType.PPO)

UNSPECIFIED = "Not specified"


@dataclass(frozen=True)
class AmountStats:
    """Money summary for one bucket of offers, in rupees."""

    count: int
    average: Optional[float]
    median: Optional[float]
    highest: Optional[float]
    lowest: Optional[float]


def summarize_amounts(amounts: Iterable[Optional[float]]) -> AmountStats:
    """
    Summarize a bucket of packages.

    Offers with no amount recorded are excluded from every statistic rather
    than counted as zero, which would drag the average toward nothing and
    report a lowest package of ₹0 for a season where one row is incomplete.
    The count therefore reports how many offers carried a figure.
    """
    values = sorted(float(a) for a in amounts if a is not None)
    if not values:
        return AmountStats(count=0, average=None, median=None, highest=None, lowest=None)

    middle = len(values) // 2
    median = (
        values[middle]
        if len(values) % 2
        else (values[middle - 1] + values[middle]) / 2
    )

    return AmountStats(
        count=len(values),
        average=sum(values) / len(values),
        median=median,
        highest=values[-1],
        lowest=values[0],
    )


def counts_by_label(labels: Iterable[Optional[str]]) -> list[tuple[str, int]]:
    """
    Group by a free-text profile field (degree, branch), largest first.

    A student who never filled the field in is grouped under "Not specified"
    instead of being dropped, so the chart's total matches the headline count.
    That group always sorts last, however large it is: it is a gap in the
    records, not a degree or a branch to compare the others against.
    """
    normalized = [(label or "").strip() or UNSPECIFIED for label in labels]
    counted = Counter(normalized)
    return sorted(
        counted.items(),
        key=lambda item: (item[0] == UNSPECIFIED, -item[1], item[0]),
    )


def placement_rate(placed_students: int, total_students: int) -> int:
    """Whole-percent share of the season's students holding a placement offer."""
    if total_students <= 0:
        return 0
    return round(placed_students / total_students * 100)


@dataclass(frozen=True)
class OfferView:
    """The four fields of an offer the headline figures need."""

    user_id: str
    company_id: str
    company_name: str
    type: OfferType
    # Only read for internships.
    ppo_status: PpoStatus = PpoStatus.PENDING


def converted_students(offers: Iterable[OfferView]) -> set[str]:
    """
    Students whose internship turned into a full-time role.

    Either the office recorded a PPO (which is a conversion by definition), or
    the student holds an internship offer and a full-time/PPO offer from the
    same company. Derived from the offers on file, so recording an offer is
    all it takes for the figure to move; nothing is flagged by hand.
    """
    offers = list(offers)
    interns = {(o.user_id, o.company_id) for o in offers if o.type == OfferType.INTERNSHIP}
    converted = {o.user_id for o in offers if o.type == OfferType.PPO}
    converted |= {
        o.user_id
        for o in offers
        if o.type in PLACEMENT_TYPES and (o.user_id, o.company_id) in interns
    }
    return converted


def internship_summary(offers: Iterable[OfferView], season_student_ids: Iterable[str]) -> dict:
    """
    Internship-side headline counts for one season.

    `eligible` is the season's students still open to a recruiter: holding no
    counted offer, or only internships whose company gave no PPO. An internship
    whose PPO outcome is pending keeps its holder out, so a student leaves the
    pool when an internship is recorded and returns when "no PPO" is recorded.
    `ppo` counts internships by that outcome.
    """
    offers = list(offers)
    student_ids = set(season_student_ids)
    interns = [o for o in offers if o.type == OfferType.INTERNSHIP]
    interns_by_student = {o.user_id for o in interns}
    holders = {
        o.user_id
        for o in offers
        if not (o.type == OfferType.INTERNSHIP and o.ppo_status == PpoStatus.NOT_RECEIVED)
    }

    by_company = counts_by_label(o.company_name for o in interns)
    return {
        "studentsWithOffers": len(interns_by_student),
        "eligibleStudents": len(student_ids - holders),
        "topRecruiter": (
            {"label": by_company[0][0], "count": by_company[0][1]} if by_company else None
        ),
        "recruiters": [{"label": label, "count": count} for label, count in by_company[:5]],
        "ppo": {
            "pending": sum(1 for o in interns if o.ppo_status == PpoStatus.PENDING),
            "received": sum(1 for o in interns if o.ppo_status == PpoStatus.RECEIVED),
            "notReceived": sum(1 for o in interns if o.ppo_status == PpoStatus.NOT_RECEIVED),
        },
    }


def conversion_summary(offers: Iterable[OfferView]) -> dict:
    """Internship-to-full-time conversion: how many, out of how many interns."""
    offers = list(offers)
    interns = {o.user_id for o in offers if o.type == OfferType.INTERNSHIP}
    converted = converted_students(offers)
    ppo_only = len(converted - interns)
    return {
        "converted": len(converted),
        "interns": len(interns),
        "rate": placement_rate(len(converted & interns), len(interns)),
        "ppoWithoutInternship": ppo_only,
    }
