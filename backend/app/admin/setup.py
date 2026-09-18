"""Mounts the table browser, or explains why it stayed off."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from sqladmin import Admin

from app.admin.auth import DatabaseAdminAuth
from app.admin.views import VIEWS
from app.core.config import settings
from app.core.database import engine

logger = logging.getLogger(__name__)

# Searched before sqladmin's own templates, so a file here replaces the
# package's copy of the same name. An absolute path, because sqladmin resolves
# this relative to the working directory and uvicorn's differs between the
# image and a developer running it by hand.
_TEMPLATES_DIR = str(Path(__file__).parent / "templates")


def _refusal() -> str | None:
    """
    Why the mount should not happen, or None to go ahead.

    The tool reaches every row in every table without consulting the RBAC
    catalog, so the checks here are the only thing standing in front of it.
    """
    password = settings.db_admin_password

    if not password:
        return (
            "DB_ADMIN_PASSWORD is not set, so the database table browser at "
            "/admin is off. Set it in .env to turn it on."
        )

    if len(password) < settings.db_admin_min_password_length:
        return (
            f"DB_ADMIN_PASSWORD is shorter than "
            f"{settings.db_admin_min_password_length} characters. It is the "
            "only thing in front of every row in the database, including "
            "password hashes, so the browser at /admin stayed off. Generate "
            "one with: openssl rand -base64 24"
        )

    if settings.is_production and password == settings.auth_secret:
        return (
            "DB_ADMIN_PASSWORD is the same value as AUTH_SECRET. Reusing the "
            "session-signing secret as a password puts it in a form field and "
            "in browser history, so the browser at /admin stayed off."
        )

    return None


def mount_admin(app: FastAPI) -> bool:
    """
    Mount the table browser at `/admin`. Returns whether it was mounted.

    A weak or absent password is a reason to leave the screen off, not a
    reason to refuse to serve the API, so this logs and returns instead of
    raising: the portal's own endpoints are unaffected either way.
    """
    refusal = _refusal()
    if refusal:
        logger.warning(refusal)
        return False

    admin = Admin(
        app=app,
        engine=engine,
        title="TNP Portal database",
        base_url="/admin",
        templates_dir=_TEMPLATES_DIR,
        authentication_backend=DatabaseAdminAuth(),
    )

    for view in VIEWS:
        admin.add_view(view)

    if settings.is_production:
        logger.warning(
            "The database table browser is mounted at /admin in production. "
            "It reaches every row in every table, around the portal's role "
            "permissions. Keep port 8000 off the public internet, or put the "
            "path behind your reverse proxy's own access control."
        )
    else:
        logger.info("Database table browser mounted at /admin (%d tables).", len(VIEWS))

    return True
