"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export type StudentSearchOption = {
  id: string;
  name: string | null;
  email: string | null;
  rollNumber: string | null;
  branch: string | null;
};

function studentSearchLabel(student: StudentSearchOption) {
  const name = student.name ?? student.email ?? "Unnamed student";
  const details = [student.rollNumber, student.branch].filter(Boolean).join(", ");
  return details ? `${name} (${details})` : name;
}

/**
 * A name-first "type to find a student" box: typing "anurag" narrows to every
 * student whose name or roll number contains it, shown as
 * `Name (RollNumber, Branch)`. Picking one calls `onSelect` with the full
 * option — the caller decides what that does (add a roll number to a bulk
 * list, fill a single-student field, etc.); this component never mutates
 * anything itself and always clears its own input after a pick so it is
 * ready for the next name.
 */
export function StudentSearch({
  students,
  onSelect,
  placeholder = "Search by student name or roll number…",
  disabledIds,
}: {
  students: StudentSearchOption[];
  onSelect: (student: StudentSearchOption) => void;
  placeholder?: string;
  /** Already-added students stay listed but are not selectable again. */
  disabledIds?: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return students
      .filter((student) => {
        const haystack = `${student.name ?? ""} ${student.rollNumber ?? ""} ${student.email ?? ""}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 25);
  }, [students, query]);

  function commit(student: StudentSearchOption) {
    onSelect(student);
    setQuery("");
    setOpen(false);
  }

  const hasQuery = query.trim().length > 0;

  return (
    <Popover open={open && hasQuery} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label="Search students by name or roll number"
            className="pl-9"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-anchor-width] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>No student matches &ldquo;{query}&rdquo;.</CommandEmpty>
            <CommandGroup>
              {matches.map((student) => {
                const disabled = disabledIds?.has(student.id) ?? false;
                return (
                  <CommandItem
                    key={student.id}
                    value={student.id}
                    disabled={disabled}
                    onSelect={() => commit(student)}
                  >
                    <span className={disabled ? "text-muted-foreground" : undefined}>
                      {studentSearchLabel(student)}
                      {disabled ? " — already added" : ""}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
