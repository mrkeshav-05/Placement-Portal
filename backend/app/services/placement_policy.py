"""
The placement cell's one-offer policy.

Which on-campus drives a student may still apply to, decided from the offers
already on file for them. Pure and DB-free so the rules are testable on their
own; routers load the rows and shape them into `PolicyOffer` / `PolicyJob`.
The frontend mirror is `frontend/src/lib/placement-policy.ts` and must give
the same answer.

The rules:

The line between First Round and Dream depends on the student's programme
(Placement Policy §4.1): 10 LPA for B.Tech, 8 LPA for M.Tech / M.Sc. / MBA /
Ph.D. A CTC exactly on the line is Dream ("10 LPA or above"). The same drive
can therefore be Dream for one student and First Round for another, so every
classification below takes the student's threshold.

- A full-time or PPO offer at or above the line is a **Dream** offer. Its holder
  is placed and may not apply to any further on-campus drive, internship
  drives included. (An off-campus internship still goes through an NOC, which
  this module never blocks.)
- A full-time or PPO offer below the line is a **First Round** offer. Its holder
  may still apply to Dream drives, and to nothing else: not another First
  Round drive and not an internship-only drive.
- An **internship** (an offer of type INTERNSHIP, which is also what an
  approved NOC records) closes every drive **until its PPO outcome is
  recorded**, however long ago it ended. If the company gave no PPO the student
  is open again; if it did, the PPO is its own offer (recorded from the
  internship) and is judged by the rules above. The end date is informational.
- Declined and revoked offers count for nothing (`COUNTED_OFFER_STATUSES`).

A package figure decides on its own when there is one. The company's
`category` ("Dream"/"First Round") is the fallback for an offer with no CTC on
file, and for a drive it is also enough on its own: the office labels a company
Dream deliberately, so a drive from it is open to First Round holders even when
the drive's own figure is missing or is a stipend.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Iterable, Optional

from app.models.db import JobType, OfferType, PpoStatus
from app.services.placement_stats import COUNTED_OFFER_STATUSES, PLACEMENT_TYPES

# Annual CTC in rupees at which an offer or drive becomes Dream, by programme
# (Placement Policy §4.1). A package exactly on the line is Dream.
BTECH_DREAM_THRESHOLD = 1_000_000
POSTGRAD_DREAM_THRESHOLD = 800_000

# Degree is free text on the profile ("M.Tech", "m tech", "MSc"), so it is
# compared on letters and digits only, the way eligibility compares it.
_POSTGRAD_DEGREES = {"MTECH", "MSC", "MBA", "PHD"}


def _degree_key(degree: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (degree or "").upper())


def dream_threshold(degree: Optional[str]) -> float:
    """
    The student's Dream line. A degree that is unset or not one of the
    postgraduate programmes is read as B.Tech, the undergraduate default and
    the higher of the two lines, so an unknown degree never makes a drive
    Dream that the policy would not.
    """
    return POSTGRAD_DREAM_THRESHOLD if _degree_key(degree) in _POSTGRAD_DEGREES else BTECH_DREAM_THRESHOLD

DREAM_CATEGORY = "dream"


class Standing(str, Enum):
    OPEN = "OPEN"
    FIRST_ROUND_PLACED = "FIRST_ROUND_PLACED"
    DREAM_PLACED = "DREAM_PLACED"
    INTERNING = "INTERNING"


STANDING_LABELS = {
    Standing.OPEN: "Open",
    Standing.FIRST_ROUND_PLACED: "Placed (First Round)",
    Standing.DREAM_PLACED: "Placed (Dream)",
    Standing.INTERNING: "Internship (PPO pending)",
}


@dataclass(frozen=True)
class PolicyOffer:
    type: OfferType
    status: object  # OfferStatus; compared against COUNTED_OFFER_STATUSES
    ctc: Optional[float]
    company_name: str
    company_category: Optional[str]
    end_date: Optional[datetime] = None
    # Only meaningful for an INTERNSHIP; other types never read it.
    ppo_status: PpoStatus = PpoStatus.PENDING


@dataclass(frozen=True)
class PolicyJob:
    type: JobType
    package: Optional[float]
    company_category: Optional[str]


@dataclass(frozen=True)
class StandingResult:
    standing: Standing
    label: str
    reason: Optional[str]
    company_name: Optional[str] = None
    ctc: Optional[float] = None
    # The student's Dream line; drives are classified against it.
    threshold: float = BTECH_DREAM_THRESHOLD


def _is_dream_category(category: Optional[str]) -> bool:
    return (category or "").strip().lower() == DREAM_CATEGORY


def _lpa(amount: float) -> str:
    return f"₹{amount / 100_000:g} LPA" if amount % 100_000 == 0 else f"₹{amount / 100_000:.2f} LPA"


def is_dream_offer(offer: PolicyOffer, threshold: float) -> bool:
    if offer.type not in PLACEMENT_TYPES:
        return False
    if offer.ctc is not None:
        return offer.ctc >= threshold
    return _is_dream_category(offer.company_category)


def is_dream_drive(job: PolicyJob, threshold: float) -> bool:
    """An internship-only drive is never Dream: it carries no placement."""
    if job.type == JobType.INTERNSHIP:
        return False
    if job.package is not None and job.package >= threshold:
        return True
    return _is_dream_category(job.company_category)


def is_pending_internship(offer: PolicyOffer) -> bool:
    """An internship whose PPO outcome the office has not recorded yet."""
    return offer.type == OfferType.INTERNSHIP and offer.ppo_status == PpoStatus.PENDING


def placement_standing(
    offers: Iterable[PolicyOffer], degree: Optional[str]
) -> StandingResult:
    threshold = dream_threshold(degree)
    counted = [o for o in offers if o.status in COUNTED_OFFER_STATUSES]

    dream = [o for o in counted if is_dream_offer(o, threshold)]
    if dream:
        best = max(dream, key=lambda o: o.ctc or 0)
        package = f" ({_lpa(best.ctc)})" if best.ctc is not None else ""
        return StandingResult(
            standing=Standing.DREAM_PLACED,
            label=STANDING_LABELS[Standing.DREAM_PLACED],
            reason=(
                f"You hold a Dream offer from {best.company_name}{package}, so on-campus "
                "applications are closed. An off-campus internship needs an NOC."
            ),
            company_name=best.company_name,
            ctc=best.ctc,
            threshold=threshold,
        )

    interning = [o for o in counted if is_pending_internship(o)]
    if interning:
        current = interning[0]
        return StandingResult(
            standing=Standing.INTERNING,
            label=STANDING_LABELS[Standing.INTERNING],
            reason=(
                f"You have an internship with {current.company_name} whose PPO outcome is "
                "not recorded yet, so on-campus applications are closed until the placement "
                "cell records it."
            ),
            company_name=current.company_name,
            threshold=threshold,
        )

    placed = [o for o in counted if o.type in PLACEMENT_TYPES]
    if placed:
        best = max(placed, key=lambda o: o.ctc or 0)
        package = f" ({_lpa(best.ctc)})" if best.ctc is not None else ""
        return StandingResult(
            standing=Standing.FIRST_ROUND_PLACED,
            label=STANDING_LABELS[Standing.FIRST_ROUND_PLACED],
            reason=(
                f"You hold a First Round offer from {best.company_name}{package}. Only Dream "
                f"drives ({_lpa(threshold)} and above) remain open to you."
            ),
            company_name=best.company_name,
            ctc=best.ctc,
            threshold=threshold,
        )

    return StandingResult(
        standing=Standing.OPEN, label=STANDING_LABELS[Standing.OPEN], reason=None, threshold=threshold
    )


def policy_allows(result: StandingResult, job: PolicyJob) -> tuple[bool, Optional[str]]:
    """Whether the standing permits applying to this drive, and why not if it does not."""
    if result.standing == Standing.OPEN:
        return True, None
    if result.standing == Standing.FIRST_ROUND_PLACED:
        if is_dream_drive(job, result.threshold):
            return True, None
        if job.type == JobType.INTERNSHIP:
            return False, (
                "Internship drives are closed to students who already hold a full-time offer."
            )
        return False, result.reason
    return False, result.reason


def policy_offer_from_row(offer) -> PolicyOffer:
    """Shape an `Offer` row (with `company` loaded) for the rules above."""
    company = getattr(offer, "company", None)
    return PolicyOffer(
        type=offer.type,
        status=offer.status,
        ctc=offer.ctc,
        company_name=(company.name if company else None) or "a company",
        company_category=company.category if company else None,
        end_date=offer.endDate,
        ppo_status=offer.ppoStatus,
    )


def policy_job_from_row(job) -> PolicyJob:
    """Shape a `JobProfile` row (with `company` loaded) for the rules above."""
    company = getattr(job, "company", None)
    return PolicyJob(
        type=job.type,
        package=job.ctcStipend,
        company_category=company.category if company else None,
    )
