"""Tests for Announcement schemas, category parsing, and permissions."""
from __future__ import annotations

import pytest
from datetime import datetime
from pydantic import ValidationError

from app.core.security import (
    PERM_ANNOUNCEMENTS_CREATE,
    compute_effective_permissions,
    has_permission,
)
from app.models.db import Announcement, AnnouncementCategory, Company, User
from app.routers.announcements import _parse_category, _to_announcement_response
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
)


def test_parse_category_valid_and_case_insensitive():
    assert _parse_category("GENERAL") == AnnouncementCategory.GENERAL
    assert _parse_category("general") == AnnouncementCategory.GENERAL
    assert _parse_category("COMPANY_EVENT") == AnnouncementCategory.COMPANY_EVENT
    assert _parse_category("Company Event") == AnnouncementCategory.COMPANY_EVENT
    assert _parse_category("company_event") == AnnouncementCategory.COMPANY_EVENT


def test_parse_category_invalid_raises_http_exception():
    with pytest.raises(Exception) as exc_info:
        _parse_category("INVALID_CAT")
    assert "Invalid category" in str(exc_info.value)


def test_announcement_create_schema_valid():
    payload = {
        "title": "Google Placement Drive 2026",
        "content": "Google will be visiting campus for 2026 batch recruitment.",
        "category": "COMPANY_EVENT",
        "tags": ["Drive", "Shortlist"],
        "companyId": "comp_123",
    }
    schema = AnnouncementCreate(**payload)
    assert schema.title == "Google Placement Drive 2026"
    assert schema.category == "COMPANY_EVENT"
    assert len(schema.tags) == 2


def test_announcement_create_schema_rejects_short_title():
    with pytest.raises(ValidationError):
        AnnouncementCreate(
            title="A",  # Less than 2 chars
            content="Valid content description",
            category="GENERAL",
        )


def test_announcement_update_schema_allows_partial_fields():
    update = AnnouncementUpdate(title="Updated Title")
    assert update.title == "Updated Title"
    assert update.content is None
    assert update.category is None


def test_to_announcement_response_formatting():
    company = Company(
        id="c1",
        name="Google",
        logoUrl="https://example.com/logo.png",
        website="https://google.com",
    )
    user = User(
        id="u1",
        name="Admin User",
        email="admin@iiitl.ac.in",
    )
    announcement = Announcement(
        id="a1",
        title="Campus Drive",
        content="Recruitment details here.",
        category=AnnouncementCategory.COMPANY_EVENT,
        tags=["Drive", "Assessment"],
        companyId="c1",
        createdById="u1",
        createdAt=datetime.now(),
    )
    announcement.company = company
    announcement.created_by = user

    resp = _to_announcement_response(announcement)
    assert resp.id == "a1"
    assert resp.title == "Campus Drive"
    assert resp.category == "COMPANY_EVENT"
    assert resp.company is not None
    assert resp.company.name == "Google"
    assert resp.createdByName == "Admin User"
    assert resp.createdByEmail == "admin@iiitl.ac.in"


def test_announcement_manage_permission_hierarchy():
    super_admin_perms = compute_effective_permissions("SUPER_ADMIN")
    assert PERM_ANNOUNCEMENTS_CREATE in super_admin_perms

    team_perms = compute_effective_permissions("PLACEMENT_TEAM")
    assert PERM_ANNOUNCEMENTS_CREATE in team_perms

    volunteer_perms = compute_effective_permissions("PLACEMENT_VOLUNTEER")
    assert PERM_ANNOUNCEMENTS_CREATE not in volunteer_perms

    student_perms = compute_effective_permissions("STUDENT")
    assert PERM_ANNOUNCEMENTS_CREATE not in student_perms

    custom_student = compute_effective_permissions("STUDENT", custom_permissions=[PERM_ANNOUNCEMENTS_CREATE])
    assert PERM_ANNOUNCEMENTS_CREATE in custom_student


def test_announcement_create_sanitizes_content_html():
    """The frontend's composer already sanitizes with the same allow-list;
    this covers a request built by hand rather than through the editor."""
    schema = AnnouncementCreate(
        title="Google Placement Drive 2026",
        content='<p onclick="x()">Round <strong>2</strong> starts <em>Monday</em>.</p>'
        '<script>alert(1)</script><img src="x" onerror="alert(1)" />',
        category="COMPANY_EVENT",
    )
    assert "onclick" not in schema.content
    assert "<script" not in schema.content
    assert "<img" not in schema.content
    assert "<strong>2</strong>" in schema.content
    assert "<em>Monday</em>" in schema.content


def test_announcement_create_content_length_checks_visible_text_not_markup():
    # Heavy formatting can push the raw HTML well past 10,000 characters
    # while the text it wraps stays short; the limit is on the text.
    heavy_markup = "<p>" + ("<strong><em>hi</em></strong> " * 400) + "</p>"
    schema = AnnouncementCreate(
        title="Formatting-heavy notice",
        content=heavy_markup,
        category="GENERAL",
    )
    assert schema.content

    with pytest.raises(ValidationError):
        AnnouncementCreate(
            title="Too short",
            content="<p><br></p>",  # No visible text at all
            category="GENERAL",
        )

    with pytest.raises(ValidationError):
        AnnouncementCreate(
            title="Way too long",
            content=f"<p>{'a' * 10001}</p>",
            category="GENERAL",
        )


def test_announcement_update_sanitizes_content_when_provided():
    update = AnnouncementUpdate(content='<p>Safe</p><script>alert(1)</script>')
    assert update.content is not None
    assert "<p>Safe</p>" in update.content
    assert "<script" not in update.content

    # Omitted stays omitted, so an edit that only changes the title never
    # touches the stored content.
    unrelated_update = AnnouncementUpdate(title="New Title")
    assert unrelated_update.content is None


def test_announcement_update_fields_set_detection():
    # When companyId is explicitly passed as None vs omitted
    update_with_none = AnnouncementUpdate(companyId=None)
    assert "companyId" in update_with_none.model_fields_set
    assert update_with_none.companyId is None

    update_omitted = AnnouncementUpdate(title="New Title")
    assert "companyId" not in update_omitted.model_fields_set
    assert "title" in update_omitted.model_fields_set

