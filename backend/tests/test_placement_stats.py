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
    assert counts_by_label(["IT", "CSE", "CSE", "ECE"]) == [("CSE", 2), ("ECE", 1), ("IT", 1)]


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
