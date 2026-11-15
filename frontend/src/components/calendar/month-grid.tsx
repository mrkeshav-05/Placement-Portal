"use client";

import { cn } from "cn";
import type { BackendCalendarEvent } from "@/lib/backend-types";
import {
  formatDayNumber,
  formatShortWeekday,
  formatTime,
  groupByDay,
  isSameMonth,
  monthMatrix,
  todayKey,
  type DayKey,
} from "@/lib/calendar-utils";
import { EVENT_TYPE_STYLES } from "./calendar-styles";

const MAX_CHIPS = 3;

export function MonthGrid({
  anchor,
  events,
  onSelectEvent,
  onCreateAt,
  onShowDay,
  fill = false,
}: {
  anchor: DayKey;
  events: BackendCalendarEvent[];
  onSelectEvent: (event: BackendCalendarEvent) => void;
  /** Absent when the viewer cannot add entries. */
  onCreateAt?: (day: DayKey) => void;
  onShowDay: (day: DayKey) => void;
  /** Stretch to the height the parent gives it instead of sizing to content. */
  fill?: boolean;
}) {
  const weeks = monthMatrix(anchor);
  const byDay = groupByDay(events);
  const today = todayKey();

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", fill && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col")} role="grid" aria-label="Month">
      <div className="grid grid-cols-7 border-b bg-[var(--navy)]" role="row">
        {weeks[0].map((day) => (
          <div
            key={day}
            role="columnheader"
            className="px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-white/90 uppercase"
          >
            {formatShortWeekday(day)}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className={cn("grid grid-cols-7 border-b last:border-b-0", fill && "lg:min-h-0 lg:flex-1")} role="row">
          {week.map((day) => {
            const dayEvents = byDay.get(day) ?? [];
            const hidden = dayEvents.length - MAX_CHIPS;
            const inMonth = isSameMonth(day, anchor);
            return (
              <div
                key={day}
                role="gridcell"
                className={cn(
                  "group relative min-h-[88px] border-r p-1 last:border-r-0 sm:min-h-[112px] sm:p-1.5",
                  fill && "lg:min-h-0 lg:overflow-hidden",
                  !inMonth && "bg-[var(--surface-alt)]/50",
                  onCreateAt && "cursor-pointer hover:bg-[var(--surface-highlight)]/40",
                )}
                onClick={onCreateAt ? () => onCreateAt(day) : undefined}
              >
                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs font-medium sm:size-7 sm:text-sm",
                      day === today
                        ? "bg-primary text-primary-foreground"
                        : inMonth
                          ? "text-foreground hover:bg-accent"
                          : "text-muted-foreground hover:bg-accent",
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onShowDay(day);
                    }}
                    aria-label={`Show ${day}`}
                  >
                    {formatDayNumber(day)}
                  </button>
                </div>
                <div className="grid gap-0.5">
                  {dayEvents.slice(0, MAX_CHIPS).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectEvent(item);
                      }}
                      className={cn(
                        "flex min-w-0 items-center gap-1 rounded-[4px] border-l-[3px] px-1 py-0.5 text-left text-[11px] leading-tight sm:text-xs",
                        EVENT_TYPE_STYLES[item.type].chip,
                      )}
                      title={item.title}
                    >
                      {!item.allDay ? (
                        <span className="hidden shrink-0 tabular-nums opacity-80 sm:inline">
                          {formatTime(item.startsAt).replace(":00", "")}
                        </span>
                      ) : null}
                      <span className="truncate font-medium">{item.title}</span>
                    </button>
                  ))}
                  {hidden > 0 ? (
                    <button
                      type="button"
                      className="rounded px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground sm:text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onShowDay(day);
                      }}
                    >
                      +{hidden} more
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
