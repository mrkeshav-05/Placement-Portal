"""Sign-in for the database table browser."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse

from app.core.config import settings

# Marks a session as signed in. The value is random per login rather than a
# constant, so a lifted cookie cannot be recognised by inspection, and
# `logout` invalidates it by clearing the session.
_SESSION_KEY = "db_admin_token"

# Its own cookie name, so signing out of the table browser does not disturb a
# portal session in the same browser and vice versa.
_COOKIE_NAME = "tnp_db_admin"

# Two hours. This session can rewrite any row in the database, so it expires
# on the timescale of the job someone opened it to do, not of a login.
_SESSION_MAX_AGE = 2 * 60 * 60


def _session_secret() -> str:
    """
    The key that signs the `/admin` session cookie.

    Derived from `AUTH_SECRET` rather than being it. One secret to configure
    is worth keeping, but the portal's JWTs and this cookie should not be
    signed by the same bytes: a key used in two schemes is a key whose
    compromise is twice as useful.
    """
    return hmac.new(
        settings.auth_secret.encode(),
        b"tnp:db-admin-session",
        hashlib.sha256,
    ).hexdigest()


class DatabaseAdminAuth(AuthenticationBackend):
    """
    A single shared password, held in `DB_ADMIN_PASSWORD`.

    The portal's own accounts are deliberately not accepted here. Their
    passwords are bcrypt hashes written by `frontend/src/lib/password.ts`, and
    `AGENTS.md` keeps that hashing in one place; checking them here would be a
    second implementation of the same comparison, on the service that is
    otherwise designed never to see a password at all.
    """

    def __init__(self) -> None:
        super().__init__(
            secret_key=_session_secret(),
            session_cookie=_COOKIE_NAME,
            max_age=_SESSION_MAX_AGE,
            same_site="lax",
            # Over plain HTTP the cookie would be readable in transit, and in
            # production there is no reason to be on plain HTTP. Locally there
            # is no TLS to require.
            https_only=settings.is_production,
        )

    async def login(self, request: Request) -> bool:
        form = await request.form()
        supplied = str(form.get("password") or "")

        # compare_digest keeps the check's duration independent of how much of
        # the password was correct, so a response time says nothing about it.
        if not hmac.compare_digest(supplied, settings.db_admin_password):
            return False

        request.session[_SESSION_KEY] = secrets.token_urlsafe(32)
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> RedirectResponse | bool:
        if request.session.get(_SESSION_KEY):
            return True
        return RedirectResponse(request.url_for("admin:login"), status_code=302)
