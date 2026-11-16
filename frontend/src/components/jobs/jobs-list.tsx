"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarClock, Hourglass, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type StudentJobListItem = {
  id: string;
  company: string;
  initials: string;
  color: string;
  title: string;
  /** Graduating batch the drive recruits. */
  batch: number;
  type: string;
  location: string;
  deadline: string;
  /** Raw deadline timestamp, used for the summary tiles. */
  deadlineAt: string;
  status: "Active" | "Closed";
};

export function JobsList({
  jobs: allJobs,
  studentBatch,
}: {
  jobs: StudentJobListItem[];
  /** The batch on the student's profile; the list opens filtered to it. */
  studentBatch?: number | null;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [batch, setBatch] = useState(studentBatch ? String(studentBatch) : "All");
  // Every batch a drive recruits, plus the student's own so it is always selectable.
  const batches = Array.from(
    new Set([...allJobs.map((job) => job.batch), ...(studentBatch ? [studentBatch] : [])]),
  ).sort((a, b) => b - a);
  const inBatch = useMemo(
    () => allJobs.filter((job) => batch === "All" || job.batch === Number(batch)),
    [allJobs, batch],
  );
  const jobTypes = ["All", ...Array.from(new Set(allJobs.map((job) => job.type)))];
  const [now] = useState(() => Date.now());
  const summary = useMemo(() => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const open = inBatch
      .filter((job) => job.status === "Active")
      .map((job) => ({ job, at: new Date(job.deadlineAt).getTime() }))
      .filter((entry) => !Number.isNaN(entry.at) && entry.at >= now)
      .sort((a, b) => a.at - b.at);
    const next = open[0];
    const days = next ? Math.max(0, Math.ceil((next.at - now) / (24 * 60 * 60 * 1000))) : null;
    return {
      open: inBatch.filter((job) => job.status === "Active").length,
      closingSoon: open.filter((entry) => entry.at - now <= week).length,
      next: next?.job,
      nextIn: days === null ? "" : days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`,
    };
  }, [inBatch, now]);
  const jobs = useMemo(
    () =>
      inBatch.filter(
        (job) =>
          (type === "All" || job.type === type) &&
          (status === "All" || job.status === status) &&
          `${job.company} ${job.title} ${job.location}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [inBatch, query, type, status],
  );

  return (
    <div className="jobs-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Campus Recruitment</span>
          <h1>Company events</h1>
          <p>Explore active campus hiring drives and review automated eligibility criteria.</p>
        </div>
        <div className="job-stats">
          <article>
            <BriefcaseBusiness size={18} />
            <strong>{summary.open}</strong>
            <span>Open for applications</span>
          </article>
          <article>
            <Hourglass size={18} />
            <strong>{summary.closingSoon}</strong>
            <span>Closing within 7 days</span>
          </article>
          <article>
            <CalendarClock size={18} />
            <strong>{summary.next ? summary.nextIn : "-"}</strong>
            <span>{summary.next ? `Next: ${summary.next.company}` : "No upcoming deadline"}</span>
          </article>
        </div>
      </section>

      <section className="mt-6 mb-4 grid items-center gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative min-w-0">
          <Label htmlFor="jobs-search" className="sr-only">
            Search company events
          </Label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2" />
          <Input
            id="jobs-search"
            placeholder="Search by company, role title, or location..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 rounded-xl bg-[var(--card-bg)] pl-11 text-[13px] shadow-[var(--card-shadow)]"
          />
        </div>

        <div className="flex h-12 items-center gap-0.5 rounded-xl bg-[var(--surface-highlight)] px-1">
          <SlidersHorizontal size={14} className="ml-1 text-[var(--muted)]" />
          <ToggleGroup
            type="single"
            spacing={0.5}
            value={type}
            // Radix clears a single toggle group when the active item is
            // pressed again; the list always filters by something, so ignore that.
            onValueChange={(next) => next && setType(next)}
          >
            {jobTypes.map((item) => (
              <ToggleGroupItem
                key={item}
                value={item}
                className="text-muted-foreground h-auto rounded-lg px-3 py-2 text-[11px] font-bold data-[state=on]:bg-[var(--card-bg)] data-[state=on]:text-[var(--ink)] data-[state=on]:shadow-[0_2px_6px_rgba(var(--shadow-rgb),0.1)]"
              >
                {item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Select value={batch} onValueChange={setBatch}>
          <SelectTrigger
            id="jobs-batch-filter"
            aria-label="Filter by batch"
            className="h-12 rounded-xl bg-[var(--card-bg)] text-xs font-semibold"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All batches</SelectItem>
            {batches.map((item) => (
              <SelectItem key={item} value={String(item)}>
                Batch {item}
                {item === studentBatch ? " (yours)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger
            id="jobs-status-filter"
            aria-label="Filter by status"
            className="h-12 rounded-xl bg-[var(--card-bg)] text-xs font-semibold"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            <SelectItem value="Active">Active only</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="jobs-table">
        <div className="jobs-row jobs-head">
          <span>Company & Role</span>
          <span>Location</span>
          <span>Application Deadline</span>
          <span>Status</span>
          <span />
        </div>
        {jobs.map((job) => (
          <Link className="jobs-row" href={`/company-events/${job.id}`} key={job.id}>
            <span className="job-company">
              <i style={{ background: job.color }}>{job.initials}</i>
              <span>
                <strong>{job.title}</strong>
                <small>
                  {job.company} · {job.type}
                </small>
              </span>
            </span>
            <span className="job-location">
              <MapPin size={15} />
              {job.location}
            </span>
            <span>{job.deadline}</span>
            <span>
              <b className={`status ${job.status.toLowerCase()}`}>{job.status}</b>
            </span>
            <span className="view-job flex items-center justify-end gap-1">
              View details <ArrowRight size={14} />
            </span>
          </Link>
        ))}
        {!jobs.length && (
          <div className="empty">
            <Search size={32} />
            <h3>No matching opportunities found</h3>
            <p>
              {allJobs.length
                ? batch !== "All"
                  ? `No drives match batch ${batch} with these filters. Choose "All batches" to see every drive.`
                  : "Try clearing your filters or using a broader search term."
                : "No campus placement drives have been published yet."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
