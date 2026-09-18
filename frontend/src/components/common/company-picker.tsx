"use client";

import { Building2, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Searchable company picker backed by the shadcn command dialog.
 *
 * The chosen value is submitted through a hidden input, so the surrounding
 * form keeps posting a single plain field and server-side Zod validation stays
 * the only source of the company rules. With `allowCustom`, a name that is not
 * in `options` can still be entered, which the interview-experience workflow
 * requires for off-campus and pooled-campus recruiters (see docs/DECISIONS.md,
 * 2026-09-15).
 *
 * The dialog is portalled by Radix, which matters because this picker is used
 * inside other dialogs: the old hand-rolled backdrop sat inside a parent whose
 * `backdrop-filter` became its containing block.
 */
export function CompanyPicker({
  id,
  name,
  options,
  defaultValue = "",
  placeholder = "Select a company",
  allowCustom = true,
}: {
  /** Put the surrounding `Label`'s `htmlFor` on the trigger, not the hidden input. */
  id?: string;
  name: string;
  options: readonly string[];
  defaultValue?: string;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  function commit(next: string) {
    setValue(next);
    setSearch("");
    setOpen(false);
  }

  const typed = search.trim();
  const canUseTyped =
    allowCustom &&
    typed.length >= 2 &&
    !options.some((option) => option.toLowerCase() === typed.toLowerCase());

  return (
    <>
      <input type="hidden" name={name} value={value} />

      <Button
        id={id}
        type="button"
        variant="outline"
        className="w-full justify-start font-normal"
        onClick={() => setOpen(true)}
      >
        <Building2 className="text-muted-foreground" />
        <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
        <ChevronDown className="ml-auto opacity-60" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Select a company"
        description="Search the recruiters already on record, or enter a new name."
      >
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search companies…"
        />
        <CommandList>
          {canUseTyped ? null : (
            <CommandEmpty>No company matches “{typed}”.</CommandEmpty>
          )}

          {canUseTyped ? (
            <CommandItem forceMount value={typed} onSelect={() => commit(typed)}>
              <Plus />
              Use “{typed}”
            </CommandItem>
          ) : null}

          {options.map((option) => (
            <CommandItem key={option} value={option} onSelect={() => commit(option)}>
              {option}
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
