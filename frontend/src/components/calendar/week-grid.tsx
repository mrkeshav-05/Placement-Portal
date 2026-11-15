"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";
import type { BackendCalendarEvent } from "@/lib/backend-types";
import {
  formatDayNumber,
  formatShortWeekday,
  formatTimeRange,
  groupByDay,
  hourLabel,
  layoutDay,
  minutesOfDay,
  todayKey,
  weekDays,
  type DayKey,
} from "@/lib/calendar-utils";
import { EVENT_TYPE_STYLES } from "./calendar-styles";

const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function WeekGrid({
  anchor,
  events,
  onSelectEvent,
  onCreateAt,
}: {
  anchor: DayKey;
  events: BackendCalendarEvent[];
  onSelectEvent: (event: BackendCalendarEvent) => void;
  onCreateAt?: (day: DayKey, time: string) => void;
}) {
  const days = weekDays(anchor);
  const byDay = groupByDay(events);
  const today = todayKey();
  const scroller = useRef<HTMLDivElement>(null);

  // Open on the working day rather than at midnight.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 8 * HOUR_PX;
  }, [anchor]);

  const allDayByDay = days.map((day) => (byDay.get(day) ?? []).filter((event) => event.allDay));
  const hasAllDay = allDayByDay.some((list) => list.length > 0);
  const nowMinutes = minutesOfDay(new Date());

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-[var(--navy)] text-white">
          <div />
          {days.map((day) => (
            <div key={day} className="border-l border-white/15 px-2 py-2 text-center">
              <div className="text-xs font-semibold tracking-wide text-white/80 uppercase">
                {formatShortWeekday(day)}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-base font-semibold",
                  day === today ? "bg-white text-[var(--navy)]" : "text-white",
                )}
              >
                {formatDayNumber(day)}
              </div>
            </div>
          ))}
        </div>

        {hasAllDay ? (
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b">
            <div className="px-1 py-1.5 text-right text-[10px] text-muted-foreground uppercase">All day</div>
            {allDayByDay.map((list, index) => (
              <div key={days[index]} className="grid content-start gap-0.5 border-l p-1">
                {list.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    className={cn(
                      "truncate rounded-[4px] border-l-[3px] px-1 py-0.5 text-left text-xs font-medium",
                      EVENT_TYPE_STYLES[event.type].chip,
                    )}
                    title={event.title}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div ref={scroller} className="max-h-[640px] overflow-y-auto">
          <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
            <div>
              {HOURS.map((hour) => (
                <div key={hour} className="relative text-right" style={{ height: HOUR_PX }}>
                  {hour > 0 ? (
                    <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground">
                      {hourLabel(hour)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            {days.map((day) => {
              const placed = layoutDay(byDay.get(day) ?? [], day);
              return (
                <div key={day} className="relative border-l">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className={cn(
                        "border-b border-[var(--border-subtle)]",
                        onCreateAt && "cursor-pointer hover:bg-[var(--surface-highlight)]/40",
                      )}
                      style={{ height: HOUR_PX }}
                      onClick={
                        onCreateAt
                          ? () => onCreateAt(day, `${String(hour).padStart(2, "0")}:00`)
                          : undefined
                      }
                    />
                  ))}
                  {day === today ? (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 bg-[var(--badge-red-text)]"
                      style={{ top: (nowMinutes / 60) * HOUR_PX }}
                      aria-hidden
                    />
                  ) : null}
                  {placed.map(({ event, top, height, column, columns }) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className={cn(
                        "absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-xs shadow-sm",
                        EVENT_TYPE_STYLES[event.type].chip,
                      )}
                      style={{
                        top: (top / 60) * HOUR_PX,
                        height: Math.max((height / 60) * HOUR_PX - 2, 20),
                        left: `calc(${(column / columns) * 100}% + 2px)`,
                        width: `calc(${100 / columns}% - 4px)`,
                      }}
                      title={`${event.title} · ${formatTimeRange(event)}`}
                    >
                      <div className="truncate font-semibold">{event.title}</div>
                      {height >= 45 ? (
                        <div className="truncate opacity-80">{formatTimeRange(event)}</div>
                      ) : null}
                      {height >= 75 && event.companyName ? (
                        <div className="truncate opacity-80">{event.companyName}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
