"""Tests for the placement-record aggregation rules and the offer schemas."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.db import OfferStatus, OfferType
from app.schemas.offer import OfferBulkCreate, OfferCreate
from app.services.placement_stats import (
    COUNTED_OFFER_STATUSES,
    PLACEMENT_TYPES,
    counts_by_label,
    placement_rate,
    summarize_amounts,
)


def test_an_empty_season_reports_nothing_rather_than_zero():
    # A season with no offers has no average package; reporting 0 would read
    # as "everybody got nothing".
    stats = summarize_amounts([])
    assert stats.count == 0
    assert stats.average is None
    assert stats.median is None
    assert stats.highest is None
    assert stats.lowest is None


def test_median_of_an_odd_and_an_even_number_of_packages():
    assert summarize_amounts([1_000_000, 3_000_000, 2_000_000]).median == 2_000_000
    assert summarize_amounts([1_000_000, 2_000_000, 3_000_000, 4_000_000]).median == 2_500_000


def test_average_highest_and_lowest_come_from_the_recorded_packages():
    stats = summarize_amounts([1_200_000, 4_400_000, 2_200_000])
    assert stats.count == 3
    assert stats.average == pytest.approx(2_600_000)
    assert stats.highest == 4_400_000
    assert stats.lowest == 1_200_000


def test_an_offer_with_no_amount_is_excluded_not_counted_as_zero():
    stats = summarize_amounts([1_000_000, None, 3_000_000])
    assert stats.count == 2
    assert stats.average == pytest.approx(2_000_000)
    assert stats.lowest == 1_000_000


def test_distributions_group_the_unfilled_field_instead_of_dropping_it():
    assert counts_by_label(["B.Tech", "B.Tech", "M.Tech", None, "  "]) == [
        ("B.Tech", 2),
        ("M.Tech", 1),
        ("Not specified", 2),
    ]


def test_distributions_are_largest_first_then_alphabetical():
    assert counts_by_label(["IT", "CS", "CS", "ECE"]) == [("CS", 2), ("ECE", 1), ("IT", 1)]


def test_placement_rate_is_a_whole_percent_and_survives_an_empty_batch():
    assert placement_rate(45, 120) == 38
    assert placement_rate(0, 0) == 0


def test_only_standing_offers_count_towards_a_season():
    # A revoked offer never stood and a declined one was given up, but both
    # rows stay on the placement-records screen.
    assert set(COUNTED_OFFER_STATUSES) == {OfferStatus.OFFERED, OfferStatus.ACCEPTED}
    assert OfferStatus.DECLINED not in COUNTED_OFFER_STATUSES
    assert OfferStatus.REVOKED not in COUNTED_OFFER_STATUSES


def test_a_ppo_counts_as_a_placement():
    assert set(PLACEMENT_TYPES) == {OfferType.FTE, OfferType.PPO}
    assert OfferType.INTERNSHIP not in PLACEMENT_TYPES


def test_a_full_time_offer_needs_an_annual_ctc():
    with pytest.raises(ValidationError):
        OfferCreate(userId="usr_1", companyId="cmp_1", type="FTE", batch=2027)

    offer = OfferCreate(userId="usr_1", companyId="cmp_1", type="FTE", batch=2027, ctc=1_800_000)
    assert offer.ctc == 1_800_000
    assert offer.status == "OFFERED"


def test_an_internship_needs_a_monthly_stipend_not_a_ctc():
    with pytest.raises(ValidationError):
        OfferCreate(userId="usr_1", companyId="cmp_1", type="INTERNSHIP", batch=2027, ctc=1_800_000)

    offer = OfferCreate(
        userId="usr_1", companyId="cmp_1", type="INTERNSHIP", batch=2027, stipend=75_000
    )
    assert offer.stipend == 75_000


def test_a_bulk_run_is_priced_by_the_same_rule_as_a_single_record():
    # Recording forty rows at once must not be a way around the amount rule.
    with pytest.raises(ValidationError):
        OfferBulkCreate(
            companyId="cmp_1", type="FTE", batch=2027, rollNumbers=["2023UCS1632"]
        )

    bulk = OfferBulkCreate(
        companyId="cmp_1",
        type="FTE",
        batch=2027,
        ctc=1_800_000,
        jobTitle="Associate Engineer",
        rollNumbers=["2023UCS1632", "2023UME4018"],
    )
    assert bulk.ctc == 1_800_000
    assert bulk.status == "OFFERED"
    assert len(bulk.rollNumbers) == 2


def test_a_bulk_run_needs_at_least_one_roll_number_and_has_an_upper_bound():
    with pytest.raises(ValidationError):
        OfferBulkCreate(companyId="cmp_1", type="PPO", batch=2027, ctc=1, rollNumbers=[])

    # A paste is a season's drive, not the whole roster; the cap keeps one
    # request from writing thousands of rows in a single transaction.
    with pytest.raises(ValidationError):
        OfferBulkCreate(
            companyId="cmp_1",
            type="PPO",
            batch=2027,
            ctc=1,
            rollNumbers=[f"ROLL{index}" for index in range(501)],
        )


def test_top_recruiters_split_placements_from_internships():
    from types import SimpleNamespace  # noqa: PLC0415

    from app.models.db import OfferType  # noqa: PLC0415
    from app.routers.analytics import _top_recruiters  # noqa: PLC0415

    def offer(company, kind):
        return SimpleNamespace(company=SimpleNamespace(name=company), type=kind)

    ranked = _top_recruiters(
        [
            offer("Acme", OfferType.FTE),
            offer("Acme", OfferType.INTERNSHIP),
            offer("Acme", OfferType.PPO),
            offer("Globex", OfferType.INTERNSHIP),
        ]
    )

    assert ranked[0] == {"label": "Acme", "count": 3, "placements": 2, "internships": 1}
    assert ranked[1] == {"label": "Globex", "count": 1, "placements": 0, "internships": 1}


# --- internship / conversion headline figures ------------------------------

from app.services.placement_stats import (  # noqa: E402
    OfferView,
    conversion_summary,
    converted_students,
    internship_summary,
)


def _offer(user: str, company: str, kind: OfferType) -> OfferView:
    return OfferView(user_id=user, company_id=company.lower(), company_name=company, type=kind)


def test_a_ppo_or_a_same_company_full_time_offer_is_a_conversion():
    offers = [
        _offer("a", "Amazon", OfferType.INTERNSHIP),
        _offer("a", "Amazon", OfferType.FTE),  # converted: same company
        _offer("b", "Zoho", OfferType.INTERNSHIP),
        _offer("b", "Atlassian", OfferType.FTE),  # different company: not a conversion
        _offer("c", "Cisco", OfferType.PPO),  # PPO is a conversion on its own
    ]
    assert converted_students(offers) == {"a", "c"}


def test_conversion_rate_is_out_of_students_who_interned():
    offers = [
        _offer("a", "Amazon", OfferType.INTERNSHIP),
        _offer("a", "Amazon", OfferType.PPO),
        _offer("b", "Zoho", OfferType.INTERNSHIP),
        _offer("c", "Cisco", OfferType.PPO),
    ]
    summary = conversion_summary(offers)
    assert summary["converted"] == 2
    assert summary["interns"] == 2
    assert summary["rate"] == 50
    assert summary["ppoWithoutInternship"] == 1


def test_eligible_students_are_those_with_no_offer_of_any_kind():
    offers = [
        _offer("a", "Amazon", OfferType.INTERNSHIP),
        _offer("b", "Zoho", OfferType.FTE),
    ]
    summary = internship_summary(offers, ["a", "b", "c", "d"])
    assert summary["studentsWithOffers"] == 1
    assert summary["eligibleStudents"] == 2


def test_top_internship_recruiter_counts_internship_offers_only():
    offers = [
        _offer("a", "Amazon", OfferType.INTERNSHIP),
        _offer("b", "Amazon", OfferType.INTERNSHIP),
        _offer("c", "Zoho", OfferType.INTERNSHIP),
        _offer("d", "Zoho", OfferType.FTE),
        _offer("e", "Zoho", OfferType.FTE),
    ]
    assert internship_summary(offers, [])["topRecruiter"] == {"label": "Amazon", "count": 2}
    assert internship_summary([], [])["topRecruiter"] is None
