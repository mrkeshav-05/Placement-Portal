"""Tests for interview experience schemas, permissions, and response formatting."""
from __future__ import annotations

from datetime import datetime
import pytest
from pydantic import ValidationError

from app.core.security import (
    PERM_INTERVIEW_EXPERIENCES_APPROVE,
    compute_effective_permissions,
)
from app.models.db import InterviewExperience, InterviewExperienceStatus, User
from app.routers.interview_experiences import _to_admin_response
from app.schemas.interview_experience import (
    AdminInterviewExperienceResponse,
    InterviewExperienceCreate,
    InterviewExperienceResponse,
)


def _valid_payload(**overrides):
    data = {
        "companyName": "Amazon India",
        "role": "SDE-1",
        "batch": 2026,
        "interviewType": "On-Campus",
        "dsaQuestions": "Reverse a linked list, LRU cache design.",
    }
    data.update(overrides)
    return data


def test_interview_experience_create_schema_valid():
    schema = InterviewExperienceCreate(**_valid_payload())
    assert schema.companyName == "Amazon India"
    assert schema.batch == 2026
    assert schema.dsaQuestions == "Reverse a linked list, LRU cache design."


def test_interview_experience_create_schema_blanks_become_none():
    schema = InterviewExperienceCreate(**_valid_payload(hrQuestions="   "))
    assert schema.hrQuestions is None


def test_interview_experience_create_schema_requires_some_content():
    with pytest.raises(ValidationError) as exc_info:
        InterviewExperienceCreate(
            companyName="Google",
            role="SWE",
            batch=2026,
            interviewType="Off-Campus",
        )
    assert "at least one question" in str(exc_info.value)


def test_interview_experience_create_schema_rejects_short_company_name():
    with pytest.raises(ValidationError):
        InterviewExperienceCreate(**_valid_payload(companyName="A"))


def test_interview_experience_manage_permission_hierarchy():
    super_admin_perms = compute_effective_permissions("SUPER_ADMIN")
    assert PERM_INTERVIEW_EXPERIENCES_APPROVE in super_admin_perms

    team_perms = compute_effective_permissions("PLACEMENT_TEAM")
    assert PERM_INTERVIEW_EXPERIENCES_APPROVE in team_perms

    volunteer_perms = compute_effective_permissions("PLACEMENT_VOLUNTEER")
    assert PERM_INTERVIEW_EXPERIENCES_APPROVE not in volunteer_perms

    student_perms = compute_effective_permissions("STUDENT")
    assert PERM_INTERVIEW_EXPERIENCES_APPROVE not in student_perms

    custom_coord = compute_effective_permissions(
        "PLACEMENT_VOLUNTEER", custom_permissions=[PERM_INTERVIEW_EXPERIENCES_APPROVE]
    )
    assert PERM_INTERVIEW_EXPERIENCES_APPROVE in custom_coord


def test_to_admin_response_formatting():
    now = datetime.now()
    user = User(
        id="usr_123",
        name="Priya Sharma",
        email="priya@iiitl.ac.in",
        rollNumber="LCS2023002",
        branch="CS",
        batch=2026,
    )
    exp = InterviewExperience(
        id="exp_456",
        userId="usr_123",
        companyName="Postman",
        role="SDE Intern",
        batch=2026,
        interviewType="On-Campus",
        dsaQuestions="Two-sum, graph BFS.",
        status=InterviewExperienceStatus.PENDING,
        createdAt=now,
        updatedAt=now,
    )
    exp.user = user

    resp = _to_admin_response(exp)
    assert resp.id == "exp_456"
    assert resp.status == "PENDING"
    assert resp.companyName == "Postman"
    assert resp.author is not None
    assert resp.author.name == "Priya Sharma"
    assert resp.author.rollNumber == "LCS2023002"


def test_interview_experience_response_model_from_attributes():
    now = datetime.now()
    exp = InterviewExperience(
        id="exp_789",
        userId="usr_1",
        companyName="Microsoft",
        role="SDE-2",
        batch=2027,
        interviewType="Off-Campus",
        status=InterviewExperienceStatus.APPROVED,
        createdAt=now,
        updatedAt=now,
    )
    resp = InterviewExperienceResponse.model_validate(exp)
    assert resp.companyName == "Microsoft"
    assert resp.status == "APPROVED"


def test_opportunity_type_accepts_only_the_three_kinds():
    base = dict(
        companyName="Amazon",
        role="SDE",
        batch=2027,
        interviewType="On-Campus",
        dsaQuestions="Two sum",
    )
    assert InterviewExperienceCreate(**base, opportunityType="INTERN_FTE").opportunityType == "INTERN_FTE"
    assert InterviewExperienceCreate(**base).opportunityType is None
    with pytest.raises(ValidationError):
        InterviewExperienceCreate(**base, opportunityType="FULL")
