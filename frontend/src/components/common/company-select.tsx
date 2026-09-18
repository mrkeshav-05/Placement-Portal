"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { cn } from "cn";

export type CompanySelectOption = { id: string; name: string };

/**
 * A searchable company combobox for fields that hold a `companyId` (a real
 * FK into the `Company` table), as opposed to `CompanyPicker` in this same
 * directory, which holds a free-text company *name* for the
 * interview-experience form's off-campus recruiters. Typing "Ama" narrows the
 * list to every company whose name contains it (Amazon, Amaze, ...) via
 * cmdk's own filtering, same as `CompanyPicker`.
 *
 * `suggestions` (typically the same curated `COMPANY_OPTIONS` list interview
 * experiences use) lets an off-campus or hackathon offer name a recruiter the
 * placement cell never opened a drive for. Picking one, or typing a name that
 * matches neither list, calls `onChange` with the plain name instead of an
 * id — the caller resolves that to a real `Company` row (finding or creating
 * one by that name) only when the record is actually saved, so browsing the
 * picker never writes anything on its own.
 */
export function CompanySelect({
  id,
  options,
  suggestions = [],
  allowCustom = true,
  value,
  onChange,
  placeholder = "Select a company",
  disabled,
}: {
  id?: string;
  options: CompanySelectOption[];
  suggestions?: readonly string[];
  allowCustom?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = options.find((option) => option.id === value);
  // Neither an id in `options` nor empty: a name was picked or typed that has
  // no Company row yet.
  const selectedLabel = selectedOption?.name ?? (value || undefined);

  const knownNames = useMemo(
    () => new Set(options.map((option) => option.name.toLowerCase())),
    [options],
  );
  const filteredSuggestions = useMemo(
    () => suggestions.filter((name) => !knownNames.has(name.toLowerCase())),
    [suggestions, knownNames],
  );

  const typed = search.trim();
  const canUseTyped =
    allowCustom &&
    typed.length >= 2 &&
    !options.some((option) => option.name.toLowerCase() === typed.toLowerCase()) &&
    !filteredSuggestions.some((name) => name.toLowerCase() === typed.toLowerCase());

  function commit(next: string) {
    onChange(next);
    setSearch("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search companies…" value={search} onValueChange={setSearch} />
          <CommandList>
            {!canUseTyped ? <CommandEmpty>No company matches.</CommandEmpty> : null}
            {canUseTyped ? (
              <CommandGroup>
                <CommandItem value={`__use__${typed}`} onSelect={() => commit(typed)}>
                  <Plus />
                  Use &ldquo;{typed}&rdquo;
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Companies">
              {options.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => commit(option.id)}>
                  <Check className={cn(option.id === value ? "opacity-100" : "opacity-0")} />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {filteredSuggestions.length ? (
              <CommandGroup heading="Not yet on the portal">
                {filteredSuggestions.map((name) => (
                  <CommandItem key={name} value={name} onSelect={() => commit(name)}>
                    <Check className={cn(name === value ? "opacity-100" : "opacity-0")} />
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
