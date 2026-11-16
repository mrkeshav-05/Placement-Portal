"use client";

import { useMemo, useState } from "react";
import { Calendar, Check, ChevronsUpDown, Landmark, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "cn";
import type { JobOption } from "./types";

/** Radix has no empty option value, so "nothing chosen" is a sentinel. */
const NONE = "__none";

const TRIGGER =
  "h-auto w-auto gap-2 border-0 bg-transparent p-0 text-[13px] font-extrabold text-[var(--ink)] normal-case shadow-none hover:transform-none focus-visible:ring-0 data-[size=default]:h-auto";

function CompanyCombobox({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { id: string; name: string }[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(TRIGGER, "hover:bg-transparent hover:text-inherit")}
        >
          <Landmark />
          <span>Company</span>
          <span className={cn(!selected && "text-muted-foreground")}>{selected?.name ?? "--"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search company..." />
          <CommandList>
            <CommandEmpty>No company matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="--"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn(!value ? "opacity-100" : "opacity-0")} />
                --
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(option.id === value ? "opacity-100" : "opacity-0")} />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The one place an event is chosen for the whole page: season → company →
 * event. The chosen event is reported up and lives in the URL, so both tabs
 * work on the same event and a link keeps it.
 */
export function ScopeBar({
  jobs,
  eventId,
  onEventChange,
}: {
  jobs: JobOption[];
  eventId: string | null;
  onEventChange: (eventId: string | null) => void;
}) {
  const selectedJob = jobs.find((job) => job.id === eventId) ?? null;
  const seasons = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.batch))).sort((a, b) => b - a),
    [jobs],
  );
  const [season, setSeason] = useState<number | null>(selectedJob?.batch ?? seasons[0] ?? null);
  const [companyId, setCompanyId] = useState<string | null>(selectedJob?.companyId ?? null);

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) {
      if (season !== null && job.batch !== season) continue;
      map.set(job.companyId, job.companyName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs, season]);

  const events = useMemo(
    () => jobs.filter((job) => job.companyId === companyId && (season === null || job.batch === season)),
    [jobs, companyId, season],
  );

  return (
    <div className="registrations-filters">
      <div className="season-picker">
        <Select
          value={season === null ? "" : String(season)}
          onValueChange={(value) => {
            setSeason(value ? Number(value) : null);
            setCompanyId(null);
            onEventChange(null);
          }}
          disabled={!seasons.length}
        >
          <SelectTrigger aria-label="Select season" className={TRIGGER}>
            <Calendar />
            <span>Season</span>
            <SelectValue placeholder="No seasons yet" />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((item) => (
              <SelectItem key={item} value={String(item)}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="season-picker">
        <CompanyCombobox
          options={companies}
          value={companyId}
          onChange={(value) => {
            setCompanyId(value || null);
            onEventChange(null);
          }}
          disabled={!companies.length}
        />
      </div>

      <div className="season-picker">
        <Select
          value={eventId ?? NONE}
          onValueChange={(value) => onEventChange(value === NONE ? null : value)}
          disabled={!companyId}
        >
          <SelectTrigger aria-label="Select company event" className={TRIGGER}>
            <Rocket />
            <span>Event</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{companyId ? "All events" : "Select a company first"}</SelectItem>
            {events.map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {eventId ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onEventChange(null)}>
          Clear event
        </Button>
      ) : null}
    </div>
  );
}
