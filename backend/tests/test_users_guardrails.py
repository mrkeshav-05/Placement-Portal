"""
Tests for the last-active-super-admin guard behind role changes,
deactivation, and deletion in `app.routers.users`.

`_blocks_last_active_super_admin` is a pure predicate specifically so it can
be tested without a database — the three call sites in the router only own
the query that counts the other active SUPER_ADMINs and pass that count in.
It used to compare against a `Role.ADMIN` that does not exist on the `Role`
enum, so every one of the three guards raised `AttributeError` (a 500) the
moment it actually ran, rather than ever reaching this decision at all.
"""
from __future__ import annotations

import pytest

from app.core import security
from app.core.config import Settings
from app.routers.users import _blocks_last_active_super_admin


@pytest.fixture
def configured(monkeypatch):
    """
    Mirrors `test_users_rbac.py`'s fixture of the same name: a fresh
    `Settings` object, never a copy of the module-level one, so its
    `admin_email_set` `cached_property` cannot carry over a value computed
    before this test set `admin_emails`.
    """

    def _apply(**overrides) -> Settings:
        base = {
            "admin_emails": "",
            "student_email_domain": "iiitl.ac.in",
            "auth_secret": "test-secret",
            "cors_origins": "http://localhost:3000",
        }
        base.update(overrides)
        replacement = Settings(**base)
        monkeypatch.setattr(security, "settings", replacement)
        return replacement

    return _apply


def test_blocks_when_no_other_active_super_admin_remains(configured):
    configured()
    assert _blocks_last_active_super_admin(0, "boss@iiitl.ac.in") is True


def test_does_not_block_when_another_active_super_admin_remains(configured):
    configured()
    assert _blocks_last_active_super_admin(1, "boss@iiitl.ac.in") is False
    assert _blocks_last_active_super_admin(5, "boss@iiitl.ac.in") is False


def test_a_bootstrap_admin_email_is_never_treated_as_the_last_one(configured):
    """
    An ADMIN_EMAILS address regains SUPER_ADMIN automatically on its next
    sign-in (see auth.ts's signIn callback), so acting on one is never
    actually the portal's last administrator in the sense this guard exists
    to prevent.
    """
    configured(admin_emails="boss@iiitl.ac.in")
    assert _blocks_last_active_super_admin(0, "boss@iiitl.ac.in") is False
    assert _blocks_last_active_super_admin(0, "someone-else@iiitl.ac.in") is True


def test_a_missing_email_is_treated_as_not_a_bootstrap_admin(configured):
    configured(admin_emails="boss@iiitl.ac.in")
    assert _blocks_last_active_super_admin(0, None) is True
