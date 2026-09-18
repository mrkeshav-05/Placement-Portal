"use client";

import { Lock } from "lucide-react";

import { PortalDialog } from "@/components/common/portal-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type ExportColumnDef<T> = {
  id: string;
  label: string;
  group: string;
  /** Always exported, shown checked and disabled. */
  locked?: boolean;
  defaultSelected?: boolean;
  value: (row: T, index: number) => string | number;
};

export function buildDefaultExportSelection<T>(columns: ExportColumnDef<T>[]): Set<string> {
  return new Set(columns.filter((c) => c.locked || c.defaultSelected).map((c) => c.id));
}

/**
 * Column picker for a customized export.
 *
 * The body scrolls and the footer does not, because the count in "Apply (13
 * columns)" is the confirmation that the selection is what was intended, and a
 * list of forty columns would otherwise push it off the screen.
 */
export function ExportColumnsDialog<T>({
  columns,
  selected,
  onChange,
  onClose,
  onApply,
}: {
  columns: ExportColumnDef<T>[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const groups = Array.from(new Set(columns.map((c) => c.group)));
  const optional = columns.filter((c) => !c.locked);
  const lockedCount = columns.length - optional.length;
  const selectedOptionalCount = optional.filter((c) => selected.has(c.id)).length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  /** Clears the group when all of it is on, otherwise fills it. */
  function toggleGroup(group: string) {
    const members = columns.filter((c) => c.group === group && !c.locked);
    const allOn = members.every((c) => selected.has(c.id));
    const next = new Set(selected);
    for (const member of members) {
      if (allOn) next.delete(member.id);
      else next.add(member.id);
    }
    onChange(next);
  }

  function selectAll() {
    const next = new Set(selected);
    for (const c of optional) next.add(c.id);
    onChange(next);
  }

  function resetDefaults() {
    onChange(buildDefaultExportSelection(columns));
  }

  return (
    <PortalDialog
      onClose={onClose}
      title="Customize Export Columns"
      description="Select which columns to include in the Excel export."
      // Wide enough for two columns of labels per group, and capped so the
      // dialog never outgrows the viewport.
      className="flex max-h-[85vh] flex-col gap-0 overflow-hidden sm:max-w-[980px]"
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b py-3.5">
        <Button type="button" variant="outline" size="sm" onClick={selectAll}>
          Select All
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={resetDefaults}>
          Reset Defaults
        </Button>
        <span className="text-muted-foreground ml-auto text-xs font-semibold">
          {lockedCount} locked &middot; {selectedOptionalCount} optional selected
        </span>
      </div>

      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 py-4">
        <div className="grid gap-5">
          {groups.map((group) => {
            const members = columns.filter((c) => c.group === group);
            const groupOptional = members.filter((c) => !c.locked);
            const checkedCount = groupOptional.filter((c) => selected.has(c.id)).length;

            return (
              <section key={group} className="grid gap-2.5">
                <Label className="w-fit font-semibold">
                  <Checkbox
                    checked={
                      !groupOptional.length || checkedCount === groupOptional.length
                        ? true
                        : checkedCount === 0
                          ? false
                          : "indeterminate"
                    }
                    disabled={!groupOptional.length}
                    onCheckedChange={() => toggleGroup(group)}
                    aria-label={`Toggle every optional column in ${group}`}
                  />
                  {group}
                </Label>

                {/* Two columns, so forty fields do not become forty rows. */}
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {members.map((c) => (
                    <Label
                      key={c.id}
                      className={
                        c.locked
                          ? "text-muted-foreground py-1.5 font-normal"
                          : "py-1.5 font-normal"
                      }
                    >
                      {c.locked ? (
                        <Lock className="size-3.5 shrink-0" aria-hidden />
                      ) : (
                        <Checkbox
                          checked={selected.has(c.id)}
                          onCheckedChange={() => toggle(c.id)}
                        />
                      )}
                      <span>
                        {c.label}
                        {c.locked ? <small> (required)</small> : null}
                      </span>
                    </Label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <DialogFooter className="shrink-0 border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={onApply}>
          Apply ({lockedCount + selectedOptionalCount} columns)
        </Button>
      </DialogFooter>
    </PortalDialog>
  );
}
