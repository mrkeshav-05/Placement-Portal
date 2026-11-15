"""
Question-bank grouping for approved interview experiences.

Students type the company and the role freely, so two Amazon SDE interviews
arrive as "Amazon"/"SDE-1" and "amazon "/"Software Development Engineer". The
bank merges them by a normalised key. Nothing is rewritten in the table: the
key is computed on read, so the text a student submitted is always kept as
they wrote it.

The role aliases below mirror the role suggestions offered in the submission
form (`ROLE_OPTIONS` in frontend/src/lib/interview-experience-schema.ts); keep
the two in step when a role is added.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

UNSPECIFIED_OPPORTUNITY = "UNSPECIFIED"

_COMPANY_SUFFIXES = {"pvt", "ltd", "limited", "private", "inc", "llc", "india", "corp", "corporation"}

# Canonical role -> the normalised spellings that mean it. A level suffix
# ("1", "i") and a trailing "intern" are stripped before the lookup, so
# "SDE-1", "SDE I" and "SDE Intern" all reach "sde".
_ROLE_ALIASES: dict[str, tuple[str, ...]] = {
    "SDE": ("sde", "software development engineer", "software developer", "software engineer", "swe"),
    "Associate Software Engineer": ("associate software engineer", "ase", "graduate engineer trainee", "get"),
    "Data Analyst": ("data analyst", "analyst data"),
    "Business Analyst": ("business analyst", "ba"),
    "Data Scientist": ("data scientist",),
    "Data Engineer": ("data engineer",),
    "Machine Learning Engineer": ("machine learning engineer", "ml engineer", "ai ml engineer", "ai engineer"),
    "Frontend Developer": ("frontend developer", "front end developer", "frontend engineer", "front end engineer"),
    "Backend Developer": ("backend developer", "back end developer", "backend engineer", "back end engineer"),
    "Full Stack Developer": ("full stack developer", "fullstack developer", "full stack engineer", "fullstack engineer"),
    "DevOps Engineer": ("devops engineer", "devops"),
    "Cloud Engineer": ("cloud engineer",),
    "QA / Test Engineer": ("qa test engineer", "qa engineer", "test engineer", "qa", "sdet"),
    "Product Analyst": ("product analyst",),
    "Technical Analyst": ("technical analyst", "technology analyst"),
    "Associate Consultant": ("associate consultant", "consultant"),
    "Systems Engineer": ("systems engineer", "system engineer"),
    "Cybersecurity Analyst": ("cybersecurity analyst", "security analyst"),
    "Product Manager": ("product manager", "pm", "apm", "associate product manager"),
}
_ROLE_LOOKUP = {alias: canonical for canonical, aliases in _ROLE_ALIASES.items() for alias in aliases}

_LEVEL = re.compile(r"\s*(?:-|\s)?\s*(?:i{1,3}|[1-3])$")
_TRAILING_INTERN = re.compile(r"\s+(?:intern|internship|trainee)$")


def _tidy(text: str) -> str:
    """Lowercase, `&` to `and`, punctuation to spaces, whitespace collapsed."""
    text = (text or "").lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def company_key(name: str) -> str:
    """The grouping key for a company: case, punctuation and legal suffixes ignored."""
    words = _tidy(name).split(" ")
    while len(words) > 1 and words[-1] in _COMPANY_SUFFIXES:
        words.pop()
    return " ".join(words)


def canonical_role(role: str) -> str:
    """
    The role a submission is filed under. Known roles collapse to one label;
    anything else keeps its own (title-cased) text so a custom role still
    groups with itself and never with a different role.
    """
    tidy = _tidy(role)
    if not tidy:
        return "Not specified"
    stripped = _TRAILING_INTERN.sub("", tidy)
    # "sde1" / "sde 1" / "sde i": drop the level, but never reduce a role to nothing.
    without_level = _LEVEL.sub("", stripped) or stripped
    for candidate in (stripped, without_level):
        if candidate in _ROLE_LOOKUP:
            return _ROLE_LOOKUP[candidate]
    spaced = re.sub(r"([a-z])(\d)$", r"\1 \2", without_level)
    if _LEVEL.sub("", spaced) in _ROLE_LOOKUP:
        return _ROLE_LOOKUP[_LEVEL.sub("", spaced)]
    return " ".join(word.capitalize() for word in without_level.split(" "))


@dataclass
class BankGroup:
    role: str
    opportunityType: str
    experiences: list[Any] = field(default_factory=list)

    @property
    def batches(self) -> list[int]:
        return sorted({e.batch for e in self.experiences}, reverse=True)

    @property
    def interviewTypes(self) -> list[str]:
        return sorted({e.interviewType for e in self.experiences if e.interviewType})


def _newest_first(experiences: Iterable[Any]) -> list[Any]:
    return sorted(experiences, key=lambda e: e.createdAt, reverse=True)


def build_groups(experiences: Iterable[Any]) -> list[BankGroup]:
    """
    One group per role + opportunity type. Biggest first, so the role most
    students have written about leads; ties fall back to the role name.
    """
    groups: dict[tuple[str, str], BankGroup] = {}
    for exp in experiences:
        role = canonical_role(exp.role)
        opportunity = getattr(exp, "opportunityType", None) or UNSPECIFIED_OPPORTUNITY
        group = groups.setdefault((role, opportunity), BankGroup(role=role, opportunityType=opportunity))
        group.experiences.append(exp)
    for group in groups.values():
        group.experiences = _newest_first(group.experiences)
    return sorted(groups.values(), key=lambda g: (-len(g.experiences), g.role, g.opportunityType))


def display_company(experiences: Iterable[Any]) -> str:
    """The spelling most submissions used for this company (first seen wins a tie)."""
    names = [e.companyName.strip() for e in experiences if e.companyName and e.companyName.strip()]
    if not names:
        return ""
    return Counter(names).most_common(1)[0][0]


def _matches(key: str, needle: str) -> bool:
    """Every typed word starts a word of the company ("zo" finds Zoho, not Amazon)."""
    words = key.split(" ")
    return all(any(word.startswith(token) for word in words) for token in needle.split(" "))


def company_summaries(experiences: Iterable[Any], search: Optional[str] = None) -> list[dict]:
    """Companies with at least one experience, most-shared first."""
    by_company: dict[str, list[Any]] = {}
    for exp in experiences:
        by_company.setdefault(company_key(exp.companyName), []).append(exp)

    needle = _tidy(search) if search else ""
    summaries = []
    for key, items in by_company.items():
        if not key or (needle and not _matches(key, needle)):
            continue
        items = _newest_first(items)
        summaries.append(
            {
                "company": display_company(items),
                "count": len(items),
                "roles": sorted({canonical_role(e.role) for e in items}),
                "latestBatch": max(e.batch for e in items),
                "lastSharedAt": items[0].createdAt,
            }
        )
    return sorted(summaries, key=lambda s: (-s["count"], s["company"].lower()))
