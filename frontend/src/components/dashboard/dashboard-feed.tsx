"use client";

import {
  BellRing,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock3,
  Paperclip,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PortalDialog } from "@/components/common/portal-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeRichText, stripHtmlToText } from "@/lib/rich-text";

export type DashboardAnnouncement = {
  id: string;
  company: string;
  title: string;
  summary: string;
  /** Files published with the announcement, in upload order. */
  attachments?: { fileName: string; fileUrl: string }[];
  date: string;
  type: string;
  category: "Company event" | "General";
  tags?: string[];
  color: string;
  initial: string;
};

export type DashboardFeedData = {
  studentName: string;
  dateLabel: string;
  metrics: {
    openOpportunities: number;
    closingThisWeek: number;
    applications: number;
    underReview: number;
    eligibleRoles: number | null;
  };
  nextDeadline: { company: string; date: string } | null;
  announcements: DashboardAnnouncement[];
};

const filters = ["All", "Company event", "General"] as const;

export function DashboardFeed({ data }: { data: DashboardFeedData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<DashboardAnnouncement | null>(null);

  const visible = useMemo(
    () =>
      data.announcements.filter(
        (announcement) =>
          (filter === "All" || announcement.category === filter) &&
          `${announcement.title} ${announcement.company} ${announcement.type} ${(announcement.tags || []).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [data.announcements, query, filter],
  );

  return (
    <div className="dashboard">
      <section className="welcome">
        <div>
          <span className="eyebrow">{data.dateLabel}</span>
          <h1>
            Welcome, {data.studentName.split(" ")[0]} <span>👋</span>
          </h1>
          <p>Here’s what’s happening with campus placements today.</p>
        </div>
        {data.nextDeadline ? (
          <div className="deadline">
            <Clock3 />
            <div>
              <span>Next deadline</span>
              <strong>
                {data.nextDeadline.company} · {data.nextDeadline.date}
              </strong>
            </div>
            <ChevronRight />
          </div>
        ) : null}
      </section>

      <section className="metrics">
        <article>
          <div className="metric-icon blue">
            <BriefcaseBusiness />
          </div>
          <div>
            <span>Open opportunities</span>
            <strong>{data.metrics.openOpportunities}</strong>
            <small>{data.metrics.closingThisWeek} closing this week</small>
          </div>
        </article>
        <article>
          <div className="metric-icon orange">
            <CalendarDays />
          </div>
          <div>
            <span>My applications</span>
            <strong>{data.metrics.applications}</strong>
            <small>{data.metrics.underReview} active in pipeline</small>
          </div>
        </article>
        <article>
          <div className="metric-icon green">
            <Sparkles />
          </div>
          <div>
            <span>Eligible roles</span>
            <strong>{data.metrics.eligibleRoles ?? "—"}</strong>
            <small>
              {data.metrics.eligibleRoles === null
                ? "Complete profile to calculate"
                : "Based on your academic profile"}
            </small>
          </div>
        </article>
      </section>

      <section className="feed-header">
        <div>
          <div className="section-icon">
            <BellRing />
          </div>
          <div>
            <h2>Announcements & Drives</h2>
            <p>Latest hiring updates, tests, and shortlist publications</p>
          </div>
        </div>
      </section>

      <section className="filters">
        {/* The search well is `.filters label`, so the label element itself has
            to stay the wrapper; its text is for assistive tech only. */}
        <Label htmlFor="announcement-search">
          <Search size={18} />
          <span className="sr-only">Search announcements</span>
          <Input
            id="announcement-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search announcements, companies, or drive types..."
            className="h-auto shadow-none focus-visible:ring-0"
          />
        </Label>
        <div>
          {filters.map((item) => (
            <Button
              type="button"
              variant="ghost"
              className={`h-auto ${filter === item ? "selected" : ""}`}
              onClick={() => setFilter(item)}
              key={item}
            >
              {item}
            </Button>
          ))}
        </div>
      </section>

      <section className="announcement-list">
        {visible.length ? (
          visible.map((item) => (
            <article
              key={item.id}
              onClick={() => setSelectedAnnouncement(item)}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedAnnouncement(item);
                }
              }}
            >
              {/* The company tint is data, not a palette choice, so it stays
                  an inline style; Tailwind cannot express a runtime value. */}
              <div className="company-logo" style={{ background: item.color }}>
                {item.initial}
              </div>
              <div className="announcement-copy">
                <div className="announcement-meta">
                  <span>{item.company}</span>
                  <i>•</i>
                  <span>{item.date}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{stripHtmlToText(item.summary)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`tag ${item.type.toLowerCase().replaceAll(" ", "-")}`}>
                    {item.type}
                  </span>
                  {item.tags && item.tags.length > 1
                    ? item.tags.slice(1, 4).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="bg-muted text-foreground text-[9px] font-bold"
                        >
                          {t}
                        </Badge>
                      ))
                    : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            <Building2 />
            <h3>No announcements found</h3>
            <p>Placement notifications and updates will appear here when published.</p>
          </div>
        )}
      </section>

      {/* STUDENT ANNOUNCEMENT DETAIL MODAL */}
      {selectedAnnouncement ? (
        <PortalDialog
          onClose={() => setSelectedAnnouncement(null)}
          eyebrow={selectedAnnouncement.category}
          title={selectedAnnouncement.title}
          className="max-h-[88vh] overflow-y-auto sm:max-w-[680px]"
        >
          <div className="grid gap-3.5">
            <Card className="bg-muted flex-row items-center justify-between gap-3 rounded-[10px] px-3.5 py-2.5 text-[11px] shadow-none">
              <div className="flex items-center gap-2">
                <div
                  className="text-primary-foreground grid size-7 place-items-center rounded-lg text-xs font-extrabold"
                  style={{ background: selectedAnnouncement.color }}
                >
                  {selectedAnnouncement.initial}
                </div>
                <strong className="text-foreground">{selectedAnnouncement.company}</strong>
              </div>

              <div className="text-muted-foreground flex items-center gap-1.5">
                <Calendar size={13} />
                <span>{selectedAnnouncement.date}</span>
              </div>
            </Card>

            {selectedAnnouncement.tags && selectedAnnouncement.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedAnnouncement.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-[var(--badge-blue-bg)] text-[10px] font-bold text-[var(--blue)]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}

            <Card
              className="rte-content rte-content--preview bg-card text-foreground rounded-[10px] p-4 shadow-none"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichText(selectedAnnouncement.summary),
              }}
            />

            {selectedAnnouncement.attachments?.length ? (
              <div className="grid gap-2">
                <span className="text-muted-foreground text-[10px] font-extrabold tracking-wider uppercase">
                  Attachments ({selectedAnnouncement.attachments.length})
                </span>
                <div className="attachment-links">
                  {selectedAnnouncement.attachments.map((file) => (
                    <a key={file.fileUrl} href={file.fileUrl} target="_blank" rel="noreferrer">
                      <Paperclip />
                      {file.fileName}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setSelectedAnnouncement(null)}>
              Close
            </Button>
          </DialogFooter>
        </PortalDialog>
      ) : null}
    </div>
  );
}
