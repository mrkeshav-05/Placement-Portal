"""
One table browser view per SQLAlchemy model.

Every view reads and writes every column of its table, including
`passwordHash` and the AES-256-GCM identity ciphertexts. That is the point of
the tool and it is why `DB_ADMIN_PASSWORD` guards the whole mount. The
ciphertexts are shown as stored — this screen has no key and does not decrypt,
so `AGENTS.md`'s rule about never returning a raw Aadhaar or PAN still holds.

The views are generated from the mapper rather than hand-written, so a column
added by a Prisma migration and mirrored into `app/models/db.py` appears here
without a third edit.
"""

from __future__ import annotations

import secrets
import time
from typing import Any

from sqladmin import ModelView
from sqladmin.models import ModelViewMeta
from sqlalchemy import Enum as SAEnum, String, Text, inspect as sa_inspect
from starlette.requests import Request

from app.models import db

# Written by Postgres on insert, so the create form leaves them out and lets
# the column default apply. They stay on the edit form, where the field is
# pre-filled and a correction is the whole reason to be here.
_SERVER_STAMPED = ("createdAt", "updatedAt")

# A list page wider than this is read by scrolling sideways, which is a poor
# way to find a row. Past it, `_PREVIEW_COLUMNS` picks the identifying few;
# the details page and the edit form still carry the whole table.
_PREVIEW_THRESHOLD = 12

# The columns that identify a row at a glance, for the tables too wide to list
# whole. Ordered for reading, not to match the schema.
_PREVIEW_COLUMNS: dict[str, list[str]] = {
    "User": ["id", "name", "email", "rollNumber", "role", "batch", "branch", "cgpa", "isActive"],
    "JobProfile": ["id", "title", "companyId", "type", "status", "batch", "registrationDeadline"],
    "Offer": ["id", "userId", "companyId", "jobTitle", "type", "status", "batch", "ctc", "stipend"],
    "NocRequest": ["id", "userId", "company", "city", "status", "startDate", "endDate"],
    "InterviewExperience": ["id", "userId", "companyName", "role", "batch", "interviewType", "status"],
}

# Sidebar grouping. Fifteen flat entries is a list to be read; grouped, it is
# a map of the portal, and finding the right table stops being a guess.
_CATEGORIES: dict[str, str] = {
    "User": "People",
    "Coordinator": "People",
    "TeamMember": "People",
    "Company": "Recruiting",
    "JobProfile": "Recruiting",
    "Application": "Recruiting",
    "Offer": "Recruiting",
    "Announcement": "Communication",
    "AnnouncementAttachment": "Communication",
    "Notification": "Communication",
    "Feedback": "Communication",
    "NocRequest": "Student submissions",
    "InterviewExperience": "Student submissions",
    "Resume": "Student submissions",
    "SystemSetting": "System",
}

# Newest first wherever a row has a creation time, because the row someone
# came here to fix is usually the one just written.
_DEFAULT_SORT: dict[str, tuple[str, bool]] = {
    "User": ("createdAt", True),
    "Company": ("createdAt", True),
    "JobProfile": ("createdAt", True),
    "Application": ("appliedAt", True),
    "Offer": ("createdAt", True),
    "Announcement": ("createdAt", True),
    "AnnouncementAttachment": ("uploadedAt", True),
    "Feedback": ("createdAt", True),
    "NocRequest": ("createdAt", True),
    "InterviewExperience": ("createdAt", True),
    "Resume": ("uploadedAt", True),
    "Notification": ("createdAt", True),
}

MODELS = [
    db.User,
    db.Company,
    db.JobProfile,
    db.Application,
    db.Offer,
    db.Announcement,
    db.AnnouncementAttachment,
    db.Feedback,
    db.NocRequest,
    db.InterviewExperience,
    db.Resume,
    db.Coordinator,
    db.TeamMember,
    db.Notification,
    db.SystemSetting,
]


def new_row_id() -> str:
    """
    A primary key for a row created here.

    Prisma's `cuid()` runs in the Prisma client, and the migrations give `id`
    no database default, so an insert that reaches Postgres by another route
    has to bring its own key. This is not a cuid implementation: ids are
    opaque everywhere in the portal, nothing parses them, and all that is
    required is that two rows never collide. Time first keeps them roughly
    ordered, which makes a list of them readable; the random tail is what
    actually prevents the collision.
    """
    return f"c{time.time_ns():x}{secrets.token_hex(6)}"


def _column_names(model: type) -> list[str]:
    """
    Every mapped column, in declaration order.

    Relationships are left out on purpose. Rendering one means loading the
    whole related table into a dropdown — every user, for an `Offer` — and the
    foreign key column next to it edits the same thing for one query.
    """
    return [attr.key for attr in sa_inspect(model).column_attrs]


def _searchable_columns(model: type) -> list[str]:
    """
    The columns the search box can match.

    Search is an `ILIKE`, which Postgres will only apply to text. Enum columns
    are excluded even though SQLAlchemy models them on top of `String`,
    because comparing one to a pattern raises rather than returning no rows;
    the sidebar filters are how an enum gets narrowed.
    """
    names = []
    for attr in sa_inspect(model).column_attrs:
        column_type = attr.expression.type
        if isinstance(column_type, SAEnum):
            continue
        if isinstance(column_type, (String, Text)):
            names.append(attr.key)
    return names


def _generated_pk(model: type) -> str | None:
    """
    The primary key this screen should fill in, or None to ask for it.

    A single column called `id` is a generated surrogate key and typing one by
    hand is only an opportunity to mistype it. Anything else is a key that
    carries meaning — `SystemSetting.key` is the setting's name — and guessing
    a value for it would be wrong, so the form asks.
    """
    pks = sa_inspect(model).primary_key
    if len(pks) == 1 and pks[0].key == "id":
        return "id"
    return None


class _TableView(ModelView):
    """
    Shared behaviour. The per-model subclasses only carry configuration.
    """

    # Postgres does the paging; the number is what fits on a screen.
    page_size = 50
    page_size_options = [25, 50, 100, 250]

    # Full read and write, deliberately. Deletes obey the foreign keys the
    # Prisma migrations declared, so one that would orphan a row is refused by
    # the database and surfaces here as an error rather than silent damage.
    can_create = True
    can_edit = True
    can_delete = True
    can_view_details = True
    can_export = True

    async def insert_model(self, request: Request, data: dict) -> Any:
        """Fill in a generated primary key the create form did not ask for."""
        pk = _generated_pk(self.model)
        if pk and not data.get(pk):
            data[pk] = new_row_id()
        return await super().insert_model(request, data)


def _build_view(model: type) -> type[ModelView]:
    """Assemble one view class from a model's mapper."""
    name = model.__name__
    columns = _column_names(model)
    editable_on_create = [c for c in columns if c not in _SERVER_STAMPED]

    preview = _PREVIEW_COLUMNS.get(name)
    if preview is None and len(columns) > _PREVIEW_THRESHOLD:
        preview = columns[:_PREVIEW_THRESHOLD]

    attrs: dict[str, Any] = {
        "name": name,
        "name_plural": name,
        "category": _CATEGORIES.get(name, "Other"),
        "icon": "fa-solid fa-table",
        # What the list page shows, versus everything the details page and the
        # edit form carry.
        "column_list": preview or columns,
        "column_details_list": columns,
        "column_sortable_list": columns,
        "column_searchable_list": _searchable_columns(model),
        # The primary key is on the edit form but not the create form, so a
        # mistyped foreign key can be corrected without a psql prompt while a
        # new row still gets a key that cannot collide.
        "form_include_pk": True,
        "form_columns": columns,
        "form_create_rules": [c for c in editable_on_create if c != _generated_pk(model)],
        "form_edit_rules": columns,
        "column_export_list": columns,
    }

    sort = _DEFAULT_SORT.get(name)
    if sort:
        attrs["column_default_sort"] = [sort]

    return ModelViewMeta(f"{name}Admin", (_TableView,), attrs, model=model)


VIEWS = [_build_view(model) for model in MODELS]
