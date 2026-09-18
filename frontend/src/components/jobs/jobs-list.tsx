"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, MapPin, Search, SlidersHorizontal } from "lucide-react";
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
  type: string;
  location: string;
  deadline: string;
  status: "Active" | "Closed";
};

export function JobsList({ jobs: allJobs }: { jobs: StudentJobListItem[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const jobTypes = ["All", ...Array.from(new Set(allJobs.map((job) => job.type)))];
  const jobs = useMemo(
    () =>
      allJobs.filter(
        (job) =>
          (type === "All" || job.type === type) &&
          (status === "All" || job.status === status) &&
          `${job.company} ${job.title} ${job.location}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [allJobs, query, type, status],
  );

  return (
    <div className="jobs-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Campus Recruitment</span>
          <h1>Company events</h1>
          <p>Explore active campus hiring drives and review automated eligibility criteria.</p>
        </div>
        <div className="job-count">
          <BriefcaseBusiness size={20} />
          <strong>{allJobs.filter((job) => job.status === "Active").length}</strong>
          <span>active openings</span>
        </div>
      </section>

      <section className="mt-6 mb-4 grid items-center gap-3 md:grid-cols-[1fr_auto_auto]">
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
                ? "Try clearing your filters or using a broader search term."
                : "No campus placement drives have been published yet."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
