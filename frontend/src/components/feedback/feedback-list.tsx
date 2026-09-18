"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  MessageSquare,
  MessageSquarePlus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StudentFeedbackItem = {
  id: string;
  type: string;
  subject: string;
  message?: string;
  date: string;
  resolved: boolean;
  response: string | null;
};

type StatusFilter = "ALL" | "PENDING" | "RESOLVED";

export function FeedbackList({ items }: { items: StudentFeedbackItem[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const visible = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        `${item.subject} ${item.message ?? ""} ${item.response ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesType = typeFilter === "ALL" || item.type.toUpperCase() === typeFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "RESOLVED" && item.resolved) ||
        (statusFilter === "PENDING" && !item.resolved);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [items, search, typeFilter, statusFilter]);

  function getTypeBadge(type: string) {
    const norm = type.toUpperCase();
    if (norm === "QUERY") {
      return (
        <Badge className="bg-[var(--badge-blue-bg)] text-[10px] font-bold text-[var(--badge-blue-text)]">
          <HelpCircle /> Query
        </Badge>
      );
    }
    if (norm === "COMPLAINT") {
      return (
        <Badge className="bg-[var(--badge-red-bg)] text-[10px] font-bold text-[var(--badge-red-text)]">
          <AlertCircle /> Complaint
        </Badge>
      );
    }
    return (
      <Badge className="bg-[var(--badge-green-bg)] text-[10px] font-bold text-[var(--badge-green-text)]">
        <MessageSquare /> Feedback
      </Badge>
    );
  }

  return (
    <div className="module-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Support history</span>
          <h1>My feedbacks & queries</h1>
          <p>Track your messages and responses from the Training & Placement Cell.</p>
        </div>
        <Link className="primary-link" href="/feedback/new">
          <MessageSquarePlus />
          New message
        </Link>
      </section>

      {/* Filter toolbar */}
      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-0 flex-[1_1_260px]">
          <Label htmlFor="feedback-search" className="sr-only">
            Search your messages or replies
          </Label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            id="feedback-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your messages or replies..."
            className="h-11 rounded-xl bg-[var(--card-bg)] pl-10 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              id="feedback-type-filter"
              aria-label="Filter by type"
              className="h-11 rounded-xl bg-[var(--card-bg)] text-[11px] font-semibold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Message Types</SelectItem>
              <SelectItem value="QUERY">Queries</SelectItem>
              <SelectItem value="FEEDBACK">Feedback</SelectItem>
              <SelectItem value="COMPLAINT">Complaints</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger
              id="feedback-status-filter"
              aria-label="Filter by status"
              className="h-11 rounded-xl bg-[var(--card-bg)] text-[11px] font-semibold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Awaiting Response</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="grid gap-3">
        {visible.map((item) => (
          <Card key={item.id} className="flex-row gap-4 p-5">
            <div className={`feedback-state ${item.resolved ? "resolved" : "pending"}`}>
              {item.resolved ? <CheckCircle2 /> : <Clock3 />}
            </div>

            <CardContent className="min-w-0 flex-1 px-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getTypeBadge(item.type)}
                  <span className="text-muted-foreground text-[10px] font-bold">
                    {item.id} · {item.date}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-bold ${
                    item.resolved ? "text-[var(--green)]" : "text-[var(--orange)]"
                  }`}
                >
                  {item.resolved ? "Resolved" : "Awaiting response"}
                </span>
              </div>

              <h2 className="mt-1.5 mb-1 text-[15px] font-extrabold text-[var(--ink)]">
                {item.subject}
              </h2>

              {item.message && (
                <p className="text-muted-foreground mt-1 mb-2 text-xs leading-normal">
                  {item.message}
                </p>
              )}

              {item.response && (
                <blockquote className="mt-3 rounded-r-[10px] border-l-[3px] border-[var(--green)] bg-[var(--surface-alt)] px-3.5 py-3 text-xs leading-relaxed text-[var(--ink)]">
                  <strong className="mb-0.5 block text-[var(--green)]">
                    Placement Team Response
                  </strong>
                  {item.response}
                </blockquote>
              )}
            </CardContent>
          </Card>
        ))}

        {!visible.length && (
          <div className="empty">
            <Search />
            <h3>{items.length ? "No matching messages" : "No messages yet"}</h3>
            <p>
              {items.length
                ? "No messages match your selected filters."
                : "Submit a feedback, query, or complaint to reach out to the placement team."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
