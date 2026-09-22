"""Tests for the student profile update boundary: closed lists and precision."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.student import (
    BLOOD_GROUPS_VALUES,
    GENDERS_VALUES,
    StudentAcademicCorrection,
    StudentProfileUpdate,
)


def test_percentages_accept_zero_to_hundred_with_two_decimals():
    for value in [0, 50, 87.65, 99.99, 100, 100.00]:
        assert StudentProfileUpdate(class10Percent=value).class10Percent == float(value)
        assert StudentProfileUpdate(class12Percent=value).class12Percent == float(value)


@pytest.mark.parametrize("value", [-1, 100.01, 105, 120, 87.653, "abc"])
def test_percentages_reject_out_of_range_and_over_precise(value):
    with pytest.raises(ValidationError):
        StudentProfileUpdate(class10Percent=value)
    with pytest.raises(ValidationError):
        StudentProfileUpdate(class12Percent=value)


@pytest.mark.parametrize("value", [0.07, 1.01, 8.15, 29.99, 87.65, 99.95])
def test_precision_is_counted_on_the_digits_sent_not_the_binary_float(value):
    """87.65 has no exact binary form; a modulo-0.01 check would reject it."""
    assert StudentProfileUpdate(class10Percent=value).class10Percent == value


def test_gender_and_blood_group_are_closed_lists():
    for value in GENDERS_VALUES:
        assert StudentProfileUpdate(gender=value).gender == value
    for value in BLOOD_GROUPS_VALUES:
        assert StudentProfileUpdate(bloodGroup=value).bloodGroup == value


@pytest.mark.parametrize("value", ["Other", "male", "MALE", "M", "anything"])
def test_gender_rejects_anything_else(value):
    with pytest.raises(ValidationError):
        StudentProfileUpdate(gender=value)


@pytest.mark.parametrize("value", ["C+", "a+", "O positive", "AB"])
def test_blood_group_rejects_anything_else(value):
    with pytest.raises(ValidationError):
        StudentProfileUpdate(bloodGroup=value)


def test_roster_owned_and_academic_fields_are_still_unwritable():
    """A crafted payload cannot set what the roster owns, or cgpa/backlogs."""
    model = StudentProfileUpdate(
        name="Someone Else",
        rollNumber="FAKE9999",
        branch="FAKE",
        degree="PhD",
        batch=1999,
        cgpa=9.1,
        backlogs=0,
    )
    assert model.model_dump(exclude_unset=True) == {}


class TestStudentAcademicCorrection:
    """The placement-office-only counterpart: PATCH /students/admin/{id}/academic."""

    def test_cgpa_shares_precision_but_is_out_of_ten(self):
        assert StudentAcademicCorrection(cgpa=9.75).cgpa == 9.75
        with pytest.raises(ValidationError):
            StudentAcademicCorrection(cgpa=10.01)
        with pytest.raises(ValidationError):
            StudentAcademicCorrection(cgpa=8.765)

    def test_backlogs_accepts_zero_through_twenty(self):
        for value in range(0, 21):
            assert StudentAcademicCorrection(backlogs=value).backlogs == value

    @pytest.mark.parametrize("value", [21, 100, -1])
    def test_backlogs_rejects_values_outside_the_list(self, value):
        with pytest.raises(ValidationError):
            StudentAcademicCorrection(backlogs=value)

    def test_either_field_can_be_corrected_independently(self):
        assert StudentAcademicCorrection(cgpa=8.5).model_dump(exclude_unset=True) == {"cgpa": 8.5}
        assert StudentAcademicCorrection(backlogs=2).model_dump(exclude_unset=True) == {"backlogs": 2}
