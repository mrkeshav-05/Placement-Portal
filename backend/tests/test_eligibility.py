"""Tests for the shared eligibility engine: branch, degree, and gender comparisons."""
from __future__ import annotations

from app.services.eligibility import evaluate_eligibility, is_eligible

BASE_KWARGS = dict(
    cgpa=8.2,
    batch=2027,
    degree="B.Tech",
    gender="Male",
    backlogs=0,
    bans=0,
    documents_complete=True,
    min_cgpa=7.5,
    job_batch=2027,
    allowed_branches=["CSE", "IT"],
    allowed_degrees=["B.Tech"],
    allowed_genders=[],
    max_backlogs=0,
)


def passed(key: str, **overrides) -> bool:
    kwargs = dict(BASE_KWARGS, **overrides)
    branch = kwargs.pop("branch", "CSE")
    return next(
        c for c in evaluate_eligibility(branch=branch, **kwargs) if c.key == key
    ).passed


def test_eligible_student_passes_every_criterion():
    checks = evaluate_eligibility(branch="CSE", **BASE_KWARGS)
    assert is_eligible(checks)


def test_a_failed_criterion_makes_the_student_ineligible():
    kwargs = dict(BASE_KWARGS, cgpa=6.9)
    checks = evaluate_eligibility(branch="CSE", **kwargs)
    assert not is_eligible(checks)
    assert next(c for c in checks if c.key == "cgpa").passed is False


def test_branch_comparison_is_case_and_whitespace_insensitive():
    checks = evaluate_eligibility(branch=" cse ", **BASE_KWARGS)
    assert next(c for c in checks if c.key == "branch").passed is True
    assert is_eligible(checks)


def test_branch_comparison_still_rejects_a_genuinely_different_branch():
    checks = evaluate_eligibility(branch="mech", **BASE_KWARGS)
    assert next(c for c in checks if c.key == "branch").passed is False
    assert not is_eligible(checks)


def test_a_degree_outside_the_allowed_list_is_rejected():
    checks = evaluate_eligibility(branch="CSE", **dict(BASE_KWARGS, degree="MBA"))
    assert next(c for c in checks if c.key == "degree").passed is False
    assert not is_eligible(checks)


def test_degree_comparison_ignores_punctuation_spacing_and_case():
    assert passed("degree", degree="b tech") is True
    assert passed("degree", degree="BTech") is True
    assert passed("degree", degree="B.Tech.") is True


def test_an_empty_or_open_degree_list_places_no_restriction():
    assert passed("degree", degree="MBA", allowed_degrees=[]) is True
    assert passed("degree", degree=None, allowed_degrees=[]) is True
    assert passed("degree", degree="MBA", allowed_degrees=["All"]) is True
    assert passed("degree", degree=None, allowed_degrees=["any"]) is True


def test_an_unset_degree_fails_a_job_that_restricts_degrees():
    assert passed("degree", degree=None) is False
    assert passed("degree", degree="  ") is False


def test_gender_is_unrestricted_unless_the_job_lists_one():
    assert passed("gender", gender=None) is True
    assert passed("gender", gender="female", allowed_genders=["Female"]) is True
    assert passed("gender", gender="Male", allowed_genders=["Female"]) is False
    assert passed("gender", gender=None, allowed_genders=["Female"]) is False


def test_an_unset_percentage_floor_places_no_restriction():
    assert passed("class10Percent", class10_percent=None) is True
    assert passed("class12Percent", class12_percent=None) is True


def test_a_percentage_floor_rejects_a_student_below_it():
    assert passed("class10Percent", class10_percent=60, min_10_percent=75) is False
    assert passed("class12Percent", class12_percent=60, min_12_percent=75) is False


def test_a_percentage_floor_accepts_a_student_at_or_above_it():
    assert passed("class10Percent", class10_percent=75, min_10_percent=75) is True


def test_an_unset_student_percentage_fails_a_job_that_sets_a_floor():
    assert passed("class10Percent", class10_percent=None, min_10_percent=75) is False
