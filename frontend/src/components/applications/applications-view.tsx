"use client";

import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { withdrawApplication } from "@/app/applications/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StudentApplicationItem = {
  id: string;
  role: string;
  company: string;
  applied: string;
  status: ApplicationStatus;
  next: string;
  color: string;
  initials: string;
};

const steps: ApplicationStatus[] = ["APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED"];

export function ApplicationsView({ applications }: { applications: StudentApplicationItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const visible = useMemo(
    () =>
      applications.filter(
        (application) =>
          (filter === "ALL" || application.status === filter) &&
          `${application.role} ${application.company}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [applications, filter, query],
  );

  return (
    <div className="module-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Recruitment Pipeline</span>
          <h1>My applications</h1>
          <p>Track every recruitment stage from registration to final selection.</p>
        </div>
        <Link className="primary-link" href="/company-events">
          <BriefcaseBusiness size={16} />
          Explore opportunities
        </Link>
      </section>

      <section className="application-stats">
        <article>
          <strong>{applications.length}</strong>
          <span>Total submitted</span>
        </article>
        <article>
          <strong>
            {applications.filter((a) => a.status === "SHORTLISTED").length}
          </strong>
          <span>Shortlisted</span>
        </article>
        <article>
          <strong>
            {applications.filter((a) => a.status === "INTERVIEW").length}
          </strong>
          <span>In interviews</span>
        </article>
        <article>
          <strong>
            {applications.filter((a) => a.status === "SELECTED").length}
          </strong>
          <span>Offers received</span>
        </article>
      </section>

      <section className="mb-3.5 flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-[1_1_240px]">
          <Label htmlFor="applications-search" className="sr-only">
            Search applications
          </Label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[17px] -translate-y-1/2" />
          <Input
            id="applications-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by company or role..."
            className="h-11 rounded-xl bg-[var(--card-bg)] pl-11 text-[13px] shadow-[var(--card-shadow)]"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger
            id="applications-status-filter"
            aria-label="Filter by status"
            className="h-11 rounded-xl bg-[var(--card-bg)] text-xs font-semibold"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {["APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED", "WITHDRAWN"].map(
              (status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </section>

      <section className="application-list">
        {visible.map((item) => {
          const active = steps.indexOf(item.status);
          return (
            <article key={item.id}>
              <div className="application-title">
                <i style={{ background: item.color }}>{item.initials}</i>
                <div>
                  <span>{item.company}</span>
                  <h2>{item.role}</h2>
                  <small>
                    <CalendarDays size={13} /> Applied {item.applied}
                  </small>
                </div>
                <b className={`application-status ${item.status.toLowerCase()}`}>
                  {item.status}
                </b>
              </div>

              {active >= 0 && (
                <div className="status-track">
                  {steps.map((step, index) => (
                    <div className={index <= active ? "done" : ""} key={step}>
                      <span>
                        {index < active ? (
                          <CheckCircle2 size={18} />
                        ) : index === active ? (
                          <Clock3 size={18} />
                        ) : (
                          <i />
                        )}
                      </span>
                      <small>{step}</small>
                    </div>
                  ))}
                </div>
              )}

              <div className="application-footer">
                <span>
                  <FileText size={14} />
                  {item.next}
                </span>
                {["APPLIED", "SHORTLISTED"].includes(item.status) && (
                  <form action={withdrawApplication}>
                    <input type="hidden" name="applicationId" value={item.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:text-destructive text-[10px] font-bold"
                    >
                      Withdraw application
                    </Button>
                  </form>
                )}
              </div>
            </article>
          );
        })}

        {!visible.length && (
          <div className="empty">
            <Search size={32} />
            <h3>
              {applications.length ? "No matching applications" : "No applications submitted yet"}
            </h3>
            <p>
              {applications.length
                ? "Try adjusting your filter or search query."
                : "Active applications you submit for campus drives will be tracked here."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
