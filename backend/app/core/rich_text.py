"""Sanitizing the announcement rich text field.

The frontend's composer runs a Tiptap editor through DOMPurify with this
same allow-list (`frontend/src/lib/rich-text.ts`) before it ever reaches
this API. This module exists for the request that skips the composer
entirely — a hand-built call against `/api/v1/announcements` — so the tags
an admin could actually produce with the editor's toolbar are the only
ones that ever land in the database, regardless of caller.
"""
from __future__ import annotations

import re

import bleach

# Kept in lockstep with `ALLOWED_TAGS`/`ALLOWED_ATTR` in
# `frontend/src/lib/rich-text.ts` — the editor's toolbar produces exactly
# these tags and nothing else.
ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
]
ALLOWED_ATTRIBUTES = {"a": ["href", "target", "rel"]}

_TAG_RE = re.compile(r"<[^>]*>")
_WHITESPACE_RE = re.compile(r"\s+")


def sanitize_announcement_html(html: str) -> str:
    """Strips anything outside the editor's own allow-list."""
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES, strip=True).strip()


def strip_html_to_text(html: str) -> str:
    """Plain text, for length checks the same way the frontend applies them."""
    return _WHITESPACE_RE.sub(" ", _TAG_RE.sub(" ", html)).strip()
