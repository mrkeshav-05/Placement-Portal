"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cn } from "cn";
import { deleteCalendarEventAction, saveCalendarEventAction } from "@/app/calendar/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BackendCalendarEvent, BackendCalendarOptions, CalendarEventType } from "@/lib/backend-types";
import {
  calendarFormFromEvent,
  emptyCalendarForm,
  EVENT_TYPE_LABELS,
  type CalendarEventFormValues,
} from "@/lib/calendar-schema";
import {
  formatMonthTitle,
  formatWeekTitle,
  shiftAnchor,
  todayKey,
  type CalendarView as View,
  type DayKey,
} from "@/lib/calendar-utils";
import { AgendaList } from "./agenda-list";
import { EVENT_TYPE_STYLES } from "./calendar-styles";
import { EventDetailsDialog } from "./event-details-dialog";
import { EventFormDialog } from "./event-form-dialog";
import { MonthGrid } from "./month-grid";
import { WeekGrid } from "./week-grid";

const ALL = "__all__";
const LEGEND_TYPES: CalendarEventType[] = [
  "COMPANY_VISIT",
  "PRE_PLACEMENT_TALK",
  "TEST",
  "INTERVIEW",
  "DEADLINE",
  "OTHER",
  "PERSONAL",
];

type Notice = { tone: "success" | "error"; text: string; warnings?: string[] };

export function CalendarView({
  mode,
  view,
  anchor,
  events,
  options,
  currentUserId,
  canCreateShared,
  backendError,
  fit = false,
}: {
  mode: "staff" | "student";
  view: View;
  anchor: DayKey;
  events: BackendCalendarEvent[];
  /** Staff form options; null for students or a viewer without calendar.manage. */
  options: BackendCalendarOptions | null;
  currentUserId: string;
  canCreateShared: boolean;
  backendError: string | null;
  /** On large screens, fit the month inside the viewport instead of scrolling. */
  fit?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<BackendCalendarEvent | null>(null);
  const [form, setForm] = useState<CalendarEventFormValues | null>(null);
  const [formMode, setFormMode] = useState<"staff" | "student">(mode);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [companyFilter, setCompanyFilter] = useState<string>(ALL);

  // Students add reminders; staff with calendar.manage add shared entries.
  // A staff viewer without it (faculty) only reads.
  const canCreate = mode === "student" || canCreateShared;

  const href = (nextView: View, nextAnchor: DayKey) => `${pathname}?view=${nextView}&date=${nextAnchor}`;

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const event of events) {
      if (event.companyId && event.companyName) seen.set(event.companyId, event.companyName);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const visible = useMemo(
    () =>
      events.filter((event) => {
        if (mineOnly && !event.pocs.some((poc) => poc.id === currentUserId) && event.createdById !== currentUserId) {
          return false;
        }
        if (typeFilter !== ALL && event.type !== typeFilter) return false;
        if (companyFilter !== ALL && event.companyId !== companyFilter) return false;
        return true;
      }),
    [events, mineOnly, typeFilter, companyFilter, currentUserId],
  );

  function openCreate(day: DayKey, time = "10:00") {
    if (!canCreate) return;
    const as = mode === "staff" ? "staff" : "student";
    setFormMode(as);
    setForm(emptyCalendarForm(day, time, as));
  }

  function openEdit(event: BackendCalendarEvent) {
    setSelected(null);
    setFormMode(event.type === "PERSONAL" ? "student" : "staff");
    // Opened a frame later: mounted during the click that closed the details
    // dialog, the form reads that same click as an outside press and closes.
    const values = calendarFormFromEvent(event);
    window.requestAnimationFrame(() => setForm(values));
  }

  async function save(values: CalendarEventFormValues): Promise<string | null> {
    const result = await saveCalendarEventAction(values);
    if (result.error) return result.error;
    setForm(null);
    setNotice({ tone: "success", text: result.success ?? "Saved.", warnings: result.warnings });
    startTransition(() => router.refresh());
    return null;
  }

  async function remove(event: BackendCalendarEvent) {
    const result = await deleteCalendarEventAction({ id: event.id });
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
    } else {
      setNotice({ tone: "success", text: result.success ?? "Deleted." });
      startTransition(() => router.refresh());
    }
    setSelected(null);
  }

  const title = view === "week" ? formatWeekTitle(anchor) : formatMonthTitle(anchor);
  const today = todayKey();

  return (
    <div className={cn("grid gap-4", fit && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-3")}>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={href(view, today)}>Today</Link>
        </Button>
        <div className="flex items-center">
          <Button asChild variant="ghost" size="icon" aria-label="Previous">
            <Link href={href(view, shiftAnchor(view, anchor, -1))}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Next">
            <Link href={href(view, shiftAnchor(view, anchor, 1))}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <h2 className="mr-auto text-lg font-semibold sm:text-xl">{title}</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={(next) => {
            if (next) router.push(href(next as View, anchor));
          }}
          aria-label="Calendar view"
        >
          <ToggleGroupItem value="month" className="px-3">Month</ToggleGroupItem>
          <ToggleGroupItem value="week" className="px-3">Week</ToggleGroupItem>
          <ToggleGroupItem value="agenda" className="px-3">List</ToggleGroupItem>
        </ToggleGroup>
        {canCreate ? (
          <Button size="sm" onClick={() => openCreate(anchor < today && view !== "week" ? today : anchor)}>
            <Plus /> {mode === "staff" ? "New entry" : "Add reminder"}
          </Button>
        ) : null}
      </div>

      {mode === "staff" ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={mineOnly} onCheckedChange={setMineOnly} />
            Only my entries (POC or added by me)
          </label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" className="w-48" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {LEGEND_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger size="sm" className="w-48" aria-label="Filter by company">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All companies</SelectItem>
              {companies.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {backendError ? (
        <Alert variant="destructive">
          <AlertDescription>{backendError}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant={notice.tone === "success" ? (notice.warnings?.length ? "info" : "success") : "destructive"}>
          {notice.warnings?.length ? <AlertTitle>{notice.text} Heads up:</AlertTitle> : null}
          <AlertDescription>
            {notice.warnings?.length ? (
              <ul className="list-disc pl-4">
                {notice.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              notice.text
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {view === "month" ? (
        <MonthGrid
          anchor={anchor}
          events={visible}
          onSelectEvent={setSelected}
          onCreateAt={canCreate ? (day) => openCreate(day) : undefined}
          onShowDay={(day) => router.push(href("week", day))}
          fill={fit}
        />
      ) : view === "week" ? (
        <WeekGrid
          anchor={anchor}
          events={visible}
          onSelectEvent={setSelected}
          onCreateAt={canCreate ? (day, time) => openCreate(day, time) : undefined}
        />
      ) : (
        <AgendaList
          anchor={anchor}
          events={visible}
          onSelectEvent={setSelected}
          emptyMessage={
            mode === "staff"
              ? "Nothing scheduled this month."
              : "Nothing on your calendar this month. Drives the placement team shares will appear here."
          }
        />
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legend">
        {LEGEND_TYPES.map((type) => (
          <span key={type} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", EVENT_TYPE_STYLES[type].dot)} />
            {EVENT_TYPE_LABELS[type]}
          </span>
        ))}
        <span className="ml-auto">All times IST</span>
      </div>

      {selected ? (
        <EventDetailsDialog
          event={selected}
          mode={mode}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => remove(selected)}
        />
      ) : null}

      {form ? (
        <EventFormDialog
          key={form.id ?? "new"}
          mode={formMode}
          initial={form}
          options={options}
          onClose={() => setForm(null)}
          onSubmit={save}
        />
      ) : null}
    </div>
  );
}
