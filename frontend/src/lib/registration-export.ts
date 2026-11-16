import type { ExportColumnDef } from "@/components/admin/export-columns-dialog";

export type ExportCell = string | number;

/** The columns an export carries: every locked one, plus those the viewer ticked. */
export function selectExportColumns<T>(columns: ExportColumnDef<T>[], selected: Set<string>) {
  return columns.filter((column) => column.locked || selected.has(column.id));
}

/** Header-keyed rows, in the order given, so what is exported is what was on screen. */
export function buildExportRows<T>(
  columns: ExportColumnDef<T>[],
  selected: Set<string>,
  rows: T[],
): Record<string, ExportCell>[] {
  const chosen = selectExportColumns(columns, selected);
  return rows.map((row, index) => {
    const record: Record<string, ExportCell> = {};
    for (const column of chosen) record[column.label] = column.value(row, index);
    return record;
  });
}

/** One CSV field: quoted when it holds a delimiter, quote or newline, quotes doubled. */
function csvField(value: ExportCell): string {
  let text = String(value ?? "");
  // A leading =, +, - or @ makes Excel run the cell as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, ExportCell>[], headers?: string[]): string {
  const columns = headers ?? (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [columns.map(csvField).join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvField(row[column] ?? "")).join(","));
  return lines.join("\r\n");
}

/** A file-name-safe label such as "Amazon_SDE_Intern". */
export function exportFileLabel(...parts: (string | null | undefined)[]): string {
  const label = parts
    .filter(Boolean)
    .join("_")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return label || "registrations";
}
