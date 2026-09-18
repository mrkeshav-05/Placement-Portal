"""
Database table browser mounted at `/admin` on the FastAPI service.

This is a different thing from the admin portal at `/admin` on the frontend.
That one is the placement office's product surface and is bound by the RBAC
catalog in `app/core/security.py`. This one is a direct view of the tables,
reaching every row and every column regardless of role, so that a mistake in
the data can be corrected without a psql prompt.

Because it goes around RBAC, it is off unless `DB_ADMIN_PASSWORD` is set, and
it refuses to start behind a weak password. See `docs/DECISIONS.md`
(2026-09-18, database table browser) for why it is allowed in production.
"""

from app.admin.setup import mount_admin

__all__ = ["mount_admin"]
