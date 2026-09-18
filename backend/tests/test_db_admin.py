"""
Tests for the database table browser at `/admin`.

The password check in `app.admin.setup` is the only thing standing between
that screen and every row in every table, so it is worth asserting rather
than reading.
"""
from __future__ import annotations

import pytest

from app.admin import setup as admin_setup
from app.admin.views import (
    MODELS,
    VIEWS,
    _generated_pk,
    _searchable_columns,
    new_row_id,
)
from app.core.config import settings
from app.models.db import SystemSetting, User


@pytest.fixture
def db_admin_password(monkeypatch):
    """Set `DB_ADMIN_PASSWORD` for one test without touching the real config."""

    def _set(value: str) -> None:
        monkeypatch.setattr(settings, "db_admin_password", value, raising=False)

    return _set


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------

def test_no_password_means_no_table_browser(db_admin_password):
    # An empty value is the off switch, not a blank password. A deployment
    # that never heard of this feature must not be serving it.
    db_admin_password("")
    refusal = admin_setup._refusal()
    assert refusal is not None
    assert "DB_ADMIN_PASSWORD is not set" in refusal


def test_a_short_password_is_refused_rather_than_accepted(db_admin_password):
    # Guessing rights over every row in the database is worth a long
    # password, and a weak one here would be a weak one everywhere.
    db_admin_password("hunter2")
    refusal = admin_setup._refusal()
    assert refusal is not None
    assert "shorter than" in refusal


def test_a_long_password_opens_the_browser(db_admin_password):
    db_admin_password("x" * settings.db_admin_min_password_length)
    assert admin_setup._refusal() is None


def test_the_boundary_length_is_allowed_and_one_short_is_not(db_admin_password):
    minimum = settings.db_admin_min_password_length
    db_admin_password("y" * minimum)
    assert admin_setup._refusal() is None
    db_admin_password("y" * (minimum - 1))
    assert admin_setup._refusal() is not None


def test_in_production_the_password_may_not_be_the_signing_secret(
    db_admin_password, monkeypatch
):
    # Reusing AUTH_SECRET would put the token that signs every session into a
    # form field, a browser's history, and a password manager.
    monkeypatch.setattr(settings, "environment", "production", raising=False)
    db_admin_password(settings.auth_secret)
    refusal = admin_setup._refusal()
    assert refusal is not None
    assert "AUTH_SECRET" in refusal


def test_a_misconfigured_browser_does_not_take_the_api_down(db_admin_password):
    # The API has nothing to do with this screen. A bad password should cost
    # the operator the screen, not the portal.
    db_admin_password("")
    from fastapi import FastAPI

    assert admin_setup.mount_admin(FastAPI()) is False


# ---------------------------------------------------------------------------
# Generated keys
# ---------------------------------------------------------------------------

def test_a_created_row_gets_a_key_because_postgres_will_not_supply_one():
    # Prisma's cuid() runs in the Prisma client and the migrations give `id`
    # no database default, so a row inserted from here has to bring its own.
    assert _generated_pk(User) == "id"


def test_a_key_that_carries_meaning_is_asked_for_instead_of_invented():
    # SystemSetting.key is the setting's name. Generating one would create a
    # row nothing reads.
    assert _generated_pk(SystemSetting) is None


def test_generated_keys_do_not_collide():
    assert len({new_row_id() for _ in range(2000)}) == 2000


def test_generated_keys_sort_into_the_order_they_were_made():
    # Time first, so a list of ids reads chronologically.
    keys = [new_row_id() for _ in range(50)]
    assert keys == sorted(keys)


# ---------------------------------------------------------------------------
# Generated views
# ---------------------------------------------------------------------------

def test_every_model_has_a_view():
    assert len(VIEWS) == len(MODELS)


def test_search_skips_enum_columns_that_postgres_cannot_match():
    # SQLAlchemy models Enum on top of String, so the naive check would
    # include `role` and every search would error instead of returning rows.
    searchable = _searchable_columns(User)
    assert "role" not in searchable
    assert "email" in searchable


def test_search_skips_columns_no_ilike_applies_to():
    searchable = _searchable_columns(User)
    assert "cgpa" not in searchable          # Float
    assert "backlogs" not in searchable      # Integer
    assert "isActive" not in searchable      # Boolean
    assert "createdAt" not in searchable     # DateTime
    assert "semGPAs" not in searchable       # ARRAY(Float)


def test_the_details_page_holds_the_whole_row_even_where_the_list_previews_it():
    # A table too wide to list whole is still fully readable one row at a
    # time; the preview is about finding a row, not about hiding a column.
    user_view = next(v for v in VIEWS if v.model is User)
    assert len(user_view.column_list) < len(user_view.column_details_list)
    assert "passwordHash" in user_view.column_details_list
    assert "aadhaarEncrypted" in user_view.column_details_list


def test_the_create_form_omits_the_generated_key_and_the_edit_form_offers_it():
    user_view = next(v for v in VIEWS if v.model is User)
    assert "id" not in user_view.form_create_rules
    assert "id" in user_view.form_edit_rules


def test_the_create_form_leaves_the_server_stamped_timestamps_to_postgres():
    # They are NOT NULL with a default. A blank field on the create form
    # would be a validation error on every insert.
    user_view = next(v for v in VIEWS if v.model is User)
    assert "createdAt" not in user_view.form_create_rules
    assert "createdAt" in user_view.form_edit_rules
