"use client";

import { X } from "lucide-react";

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
 * Column-picker modal for a customized export. Mirrors the grouped
 * `.permission-category-box` layout already used for the RBAC matrix, so a
 * second, unrelated grid style did not need to be invented.
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

  function selectAll() {
    const next = new Set(selected);
    for (const c of optional) next.add(c.id);
    onChange(next);
  }

  function resetDefaults() {
    onChange(buildDefaultExportSelection(columns));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal export-columns-modal">
        <header>
          <div>
            <h2>Customize Export Columns</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Select which columns to include in the Excel export.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>

        <div className="export-columns-toolbar">
          <button type="button" className="dt-view-button" onClick={selectAll}>
            Select All
          </button>
          <button type="button" className="dt-view-button" onClick={resetDefaults}>
            Reset Defaults
          </button>
          <span className="export-columns-count">
            {lockedCount} locked &middot; {selectedOptionalCount} optional selected
          </span>
        </div>

        <div className="permission-categories-grid export-columns-grid">
          {groups.map((group) => (
            <div className="permission-category-box" key={group}>
              <h3>{group}</h3>
              {columns
                .filter((c) => c.group === group)
                .map((c) => (
                  <label key={c.id} className="dt-check">
                    <input
                      type="checkbox"
                      checked={c.locked || selected.has(c.id)}
                      disabled={c.locked}
                      onChange={() => toggle(c.id)}
                    />
                    <span>
                      {c.label}
                      {c.locked ? <small className="text-[var(--muted)]"> (required)</small> : null}
                    </span>
                  </label>
                ))}
            </div>
          ))}
        </div>

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={onApply}>
            Apply ({lockedCount + selectedOptionalCount} columns)
          </button>
        </footer>
      </div>
    </div>
  );
}
