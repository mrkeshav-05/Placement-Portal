"""Grouping and normalisation rules behind the interview question bank."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.interview_bank import (
    build_groups,
    canonical_role,
    company_key,
    company_summaries,
    display_company,
)

NOW = datetime(2026, 11, 15, tzinfo=timezone.utc)


def exp(company="Amazon", role="SDE", opportunity="INTERN_FTE", batch=2027, kind="On-Campus", age=0):
    return SimpleNamespace(
        companyName=company,
        role=role,
        opportunityType=opportunity,
        batch=batch,
        interviewType=kind,
        createdAt=NOW - timedelta(days=age),
    )


def test_company_spelling_case_and_legal_suffixes_do_not_split_a_company():
    assert company_key("Amazon") == company_key(" amazon ")
    assert company_key("Zoho Corporation") == company_key("Zoho")
    assert company_key("Tata Consultancy Services Ltd.") == company_key("tata consultancy services")
    assert company_key("Goldman Sachs") != company_key("Morgan Stanley")


def test_known_role_spellings_and_levels_share_one_role():
    for spelling in ("SDE", "SDE-1", "sde 1", "SDE I", "SDE Intern", "Software Development Engineer", "software engineer"):
        assert canonical_role(spelling) == "SDE", spelling
    assert canonical_role("Front-end Developer") == "Frontend Developer"
    assert canonical_role("ML Engineer") == "Machine Learning Engineer"


def test_unknown_roles_keep_their_own_label_and_stay_apart():
    assert canonical_role("quant researcher") == "Quant Researcher"
    assert canonical_role("Quant Researcher") != canonical_role("Quant Trader")
    assert canonical_role("   ") == "Not specified"


def test_same_company_role_and_opportunity_become_one_group_with_every_batch_and_mode():
    groups = build_groups(
        [
            exp(batch=2027, kind="On-Campus", age=2),
            exp(role="SDE-1", batch=2026, kind="Pool Campus", age=10),
            exp(role="Software Development Engineer", batch=2026, kind="Off-Campus", age=5),
        ]
    )
    assert len(groups) == 1
    group = groups[0]
    assert (group.role, group.opportunityType) == ("SDE", "INTERN_FTE")
    assert len(group.experiences) == 3
    assert group.batches == [2027, 2026]
    assert group.interviewTypes == ["Off-Campus", "On-Campus", "Pool Campus"]
    assert [e.createdAt for e in group.experiences] == sorted((e.createdAt for e in group.experiences), reverse=True)


def test_a_different_opportunity_type_or_role_is_a_different_group():
    groups = build_groups(
        [
            exp(opportunity="INTERN"),
            exp(opportunity="FTE"),
            exp(role="Data Analyst", opportunity="FTE"),
            exp(opportunity=None),
        ]
    )
    keys = {(g.role, g.opportunityType) for g in groups}
    assert keys == {
        ("SDE", "INTERN"),
        ("SDE", "FTE"),
        ("Data Analyst", "FTE"),
        ("SDE", "UNSPECIFIED"),
    }


def test_biggest_group_comes_first():
    groups = build_groups([exp(role="Data Analyst"), exp(), exp(), exp(batch=2026)])
    assert groups[0].role == "SDE"


def test_company_display_uses_the_most_common_spelling():
    items = [exp(company="Amazon"), exp(company="Amazon"), exp(company="amazon ")]
    assert display_company(items) == "Amazon"


def test_company_summaries_merge_spellings_filter_by_search_and_rank_by_count():
    items = [
        exp(company="Amazon", batch=2026),
        exp(company="amazon", role="Data Analyst", batch=2027),
        exp(company="Zoho"),
    ]
    summaries = company_summaries(items)
    assert [s["company"] for s in summaries] == ["Amazon", "Zoho"]
    assert summaries[0]["count"] == 2
    assert summaries[0]["roles"] == ["Data Analyst", "SDE"]
    assert summaries[0]["latestBatch"] == 2027
    assert [s["company"] for s in company_summaries(items, search="zo")] == ["Zoho"]
    assert company_summaries(items, search="nothing") == []
