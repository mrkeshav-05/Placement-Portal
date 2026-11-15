"use client";

import { ArrowLeft, ArrowUpRight, Building2, Calendar, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  difficultyLabel,
  opportunityTypeLabel,
  outcomeLabel,
} from "@/lib/interview-experience-schema";
import {
  SECTION_GROUPS,
  text,
  type BankCompany,
  type BankCompanyDetail,
  type BankGroup,
  type InterviewExperienceItem,
} from "./interview-sections";

const bankHref = (company?: string) =>
  company ? `/interview-experiences?company=${encodeURIComponent(company)}` : "/interview-experiences";

const opportunityName = (value: string) => opportunityTypeLabel(value) ?? "Opportunity not specified";

/** The search-first landing of the question bank: pick a company. */
export function QuestionBankLanding({
  companies,
  onShare,
}: {
  companies: BankCompany[];
  onShare: () => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return companies;
    return companies.filter((item) => {
      const words = item.company.toLowerCase().split(/[^a-z0-9]+/);
      return tokens.every((token) => words.some((word) => word.startsWith(token)));
    });
  }, [companies, query]);

  if (!companies.length) {
    return (
      <div className="empty">
        <Building2 />
        <h3>The question bank is empty</h3>
        <p>Once students share their interviews, every company&apos;s questions are collected here.</p>
        <Button className="mt-4" onClick={onShare}>
          <Plus />
          Share your experience
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
        <Input
          type="search"
          autoFocus
          className="h-12 rounded-xl pl-12 text-[15px]"
          aria-label="Search companies in the question bank"
          placeholder="Search a company to see what was asked there…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        {query.trim()
          ? `${matches.length} of ${companies.length} companies`
          : `${companies.length} ${companies.length === 1 ? "company" : "companies"} · most-shared first`}
      </p>

      {matches.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((item) => (
            <Link
              key={item.company}
              href={bankHref(item.company)}
              className="bg-card hover:border-[var(--blue)] group grid content-start gap-3 rounded-xl border p-4 no-underline transition-colors"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-foreground flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <Building2 className="size-4 shrink-0" />
                  <span className="truncate">{item.company}</span>
                </span>
                <ArrowUpRight className="text-muted-foreground group-hover:text-[var(--blue)] size-4 shrink-0 transition-colors" />
              </span>
              <span className="text-muted-foreground text-xs">
                {item.count} {item.count === 1 ? "experience" : "experiences"} · latest batch{" "}
                {item.latestBatch}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {item.roles.slice(0, 3).map((role) => (
                  <Badge key={role} variant="secondary" className="text-[10px] font-semibold">
                    {role}
                  </Badge>
                ))}
                {item.roles.length > 3 ? (
                  <Badge variant="outline" className="text-[10px]">
                    +{item.roles.length - 3}
                  </Badge>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Search />
          <h3>No company matches “{query.trim()}”</h3>
          <p>Nobody has shared an interview there yet. You could be the first.</p>
          <Button className="mt-4" onClick={onShare}>
            <Plus />
            Share your experience
          </Button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-[var(--navy)] bg-[var(--navy)] text-white"
          : "text-muted-foreground hover:border-[var(--blue)] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  // A filter with a single choice narrows nothing, so it is not drawn.
  if (options.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground w-24 shrink-0 text-xs font-semibold">{label}</span>
      <Chip active={value === ""} onClick={() => onChange("")}>
        All
      </Chip>
      {options.map((option) => (
        <Chip key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

/** Batch, campus mode, difficulty and result: what tells one entry from another. */
function EntryTags({ item }: { item: InterviewExperienceItem }) {
  const extras = [difficultyLabel(item.difficulty), outcomeLabel(item.outcome)].filter(Boolean);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="gap-1 text-[10px] font-bold">
        <Calendar className="size-3" />
        Batch {item.batch}
      </Badge>
      <Badge variant="outline" className="text-[10px] font-bold">
        {item.interviewType}
      </Badge>
      {extras.map((extra) => (
        <Badge key={extra} variant="outline" className="text-[10px] font-semibold">
          {extra}
        </Badge>
      ))}
    </span>
  );
}

function GroupBody({
  group,
  experiences,
  onOpen,
}: {
  group: BankGroup;
  experiences: InterviewExperienceItem[];
  onOpen: (item: InterviewExperienceItem) => void;
}) {
  const topics = SECTION_GROUPS.map((topic) => ({
    topic,
    entries: experiences
      .map((item) => ({
        item,
        sections: topic.sections.filter((section) => text(item, section.key).trim()),
      }))
      .filter((entry) => entry.sections.length > 0),
  })).filter((entry) => entry.entries.length > 0);

  if (!topics.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No questions were shared in these {group.role} experiences yet.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {topics.map(({ topic, entries }) => (
        <section key={topic.id} className="grid gap-3">
          <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <topic.icon className="size-3.5" />
            {topic.label}
            <span className="font-normal normal-case">
              ({entries.length} {entries.length === 1 ? "experience" : "experiences"})
            </span>
          </h3>
          {entries.map(({ item, sections }) => (
            <div key={item.id} className="bg-[var(--surface-alt)] grid gap-3 rounded-lg border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <EntryTags item={item} />
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="text-[var(--blue)] text-xs font-semibold hover:underline"
                >
                  Full experience
                </button>
              </div>
              {sections.map((section) => (
                <div key={String(section.key)}>
                  <span className="text-muted-foreground text-xs font-semibold">{section.label}</span>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{text(item, section.key)}</p>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** One company, merged by role + opportunity type, with filters to narrow it. */
export function QuestionBankCompany({
  detail,
  onOpen,
}: {
  detail: BankCompanyDetail;
  onOpen: (item: InterviewExperienceItem) => void;
}) {
  const [opportunity, setOpportunity] = useState("");
  const [batch, setBatch] = useState("");
  const [mode, setMode] = useState("");

  const options = useMemo(() => {
    const all = detail.groups.flatMap((group) => group.experiences);
    const unique = (values: string[]) => [...new Set(values)];
    return {
      opportunity: unique(detail.groups.map((group) => group.opportunityType)).map((value) => ({
        value,
        label: opportunityName(value),
      })),
      batch: unique(all.map((item) => String(item.batch)))
        .sort((a, b) => Number(b) - Number(a))
        .map((value) => ({ value, label: value })),
      mode: unique(all.map((item) => item.interviewType))
        .sort()
        .map((value) => ({ value, label: value })),
    };
  }, [detail]);

  const groups = useMemo(
    () =>
      detail.groups
        .filter((group) => !opportunity || group.opportunityType === opportunity)
        .map((group) => ({
          group,
          experiences: group.experiences.filter(
            (item) => (!batch || String(item.batch) === batch) && (!mode || item.interviewType === mode),
          ),
        }))
        .filter((entry) => entry.experiences.length > 0),
    [detail, opportunity, batch, mode],
  );

  const filtered = Boolean(opportunity || batch || mode);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Link
          href={bankHref()}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs font-semibold no-underline"
        >
          <ArrowLeft className="size-3.5" />
          All companies
        </Link>
        <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          <Building2 className="size-6" />
          {detail.company}
        </h2>
        <p className="text-muted-foreground text-sm">
          {detail.total} {detail.total === 1 ? "experience" : "experiences"} across{" "}
          {detail.groups.length} {detail.groups.length === 1 ? "role" : "roles"}, merged by role and
          opportunity type.
        </p>
      </div>

      <div className="bg-card grid gap-3 rounded-xl border p-4">
        <FilterRow label="Opportunity" options={options.opportunity} value={opportunity} onChange={setOpportunity} />
        <FilterRow label="Batch" options={options.batch} value={batch} onChange={setBatch} />
        <FilterRow label="Campus mode" options={options.mode} value={mode} onChange={setMode} />
        {options.opportunity.length < 2 && options.batch.length < 2 && options.mode.length < 2 ? (
          <p className="text-muted-foreground text-xs">
            Filters appear once there are experiences from more than one batch, mode or opportunity type.
          </p>
        ) : null}
        {filtered ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto w-fit p-0"
            onClick={() => {
              setOpportunity("");
              setBatch("");
              setMode("");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {groups.length ? (
        <Accordion
          type="multiple"
          defaultValue={groups.slice(0, 1).map(({ group }) => `${group.role}|${group.opportunityType}`)}
          className="grid gap-3"
        >
          {groups.map(({ group, experiences }) => {
            const value = `${group.role}|${group.opportunityType}`;
            const batches = [...new Set(experiences.map((item) => item.batch))].sort((a, b) => b - a);
            const modes = [...new Set(experiences.map((item) => item.interviewType))].sort();
            return (
              <AccordionItem key={value} value={value} className="bg-card rounded-xl border px-4 last:border-b">
                <AccordionTrigger className="hover:no-underline">
                  <span className="grid gap-2 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{group.role}</span>
                      <Badge className="bg-[var(--badge-blue-bg)] text-[10px] font-bold text-[var(--badge-blue-text)]">
                        {opportunityName(group.opportunityType)}
                      </Badge>
                      <span className="text-muted-foreground text-xs font-normal">
                        {experiences.length} {experiences.length === 1 ? "experience" : "experiences"}
                      </span>
                    </span>
                    <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-normal">
                      <span>Batches: {batches.join(", ")}</span>
                      <span>Asked via: {modes.join(", ")}</span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <GroupBody group={group} experiences={experiences} onOpen={onOpen} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <div className="empty">
          <Search />
          <h3>Nothing matches those filters</h3>
          <p>Try a different batch, campus mode or opportunity type.</p>
        </div>
      )}
    </div>
  );
}
