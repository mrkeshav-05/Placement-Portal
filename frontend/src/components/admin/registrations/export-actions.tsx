"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, SlidersHorizontal } from "lucide-react";
import {
  ExportColumnsDialog,
  type ExportColumnDef,
} from "@/components/admin/export-columns-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildExportRows, selectExportColumns, toCsv } from "@/lib/registration-export";
import type { AdminApplicationRow } from "./types";

const RESUME_DOWNLOAD_CONCURRENCY = 5;

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export controls shared by both tabs. Everything here works on `rows`, which
 * the table passes as what is left after its search, filters and sort, so a
 * file always holds what the viewer is looking at.
 */
export function ExportActions({
  columns,
  defaultSelection,
  rows,
  fileLabel,
  withResumes,
  onMessage,
}: {
  columns: ExportColumnDef<AdminApplicationRow>[];
  defaultSelection: Set<string>;
  rows: AdminApplicationRow[];
  fileLabel: string;
  withResumes?: boolean;
  onMessage: (message: { type: "success" | "error"; text: string }) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(defaultSelection);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zipping, setZipping] = useState(false);
  const empty = rows.length === 0;

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(buildExportRows(columns, selected, rows));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Registrations");
    XLSX.writeFile(book, `${fileLabel}.xlsx`);
  }

  function exportCsv() {
    const headers = selectExportColumns(columns, selected).map((column) => column.label);
    const csv = toCsv(buildExportRows(columns, selected, rows), headers);
    // The byte-order mark lets Excel read non-ASCII names correctly.
    saveBlob(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), `${fileLabel}.csv`);
  }

  async function downloadResumes() {
    const queue = rows.filter((row) => row.resumeUrl);
    if (!queue.length) {
      onMessage({ type: "error", text: "None of these students has a resume attached." });
      return;
    }
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used = new Set<string>();
      let failed = 0;
      let cursor = 0;

      // A small pool rather than every request at once: an event can have
      // hundreds of registrants and the browser would otherwise open them all.
      async function worker() {
        while (cursor < queue.length) {
          const row = queue[cursor++];
          try {
            const response = await fetch(row.resumeUrl!);
            if (!response.ok) throw new Error("fetch failed");
            const base = (row.rollNumber || row.studentName || row.id).replace(/[^a-z0-9-_]+/gi, "_");
            let name = base;
            for (let n = 2; used.has(name); n += 1) name = `${base}_${n}`;
            used.add(name);
            zip.file(`${name}.pdf`, await response.blob());
          } catch {
            failed += 1;
          }
        }
      }
      await Promise.all(Array.from({ length: RESUME_DOWNLOAD_CONCURRENCY }, worker));

      saveBlob(await zip.generateAsync({ type: "blob" }), `${fileLabel}_resumes.zip`);
      onMessage(
        failed
          ? { type: "error", text: `Downloaded ${queue.length - failed} resume(s); ${failed} failed.` }
          : { type: "success", text: `Downloaded ${queue.length} resume(s).` },
      );
    } finally {
      setZipping(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
        <SlidersHorizontal />
        Columns
        <Badge variant="secondary" className="rounded-full px-2">
          {selected.size}
        </Badge>
      </Button>
      {withResumes ? (
        <Button type="button" variant="outline" onClick={downloadResumes} disabled={empty || zipping}>
          <Download />
          {zipping ? "Preparing…" : "Resumes (zip)"}
        </Button>
      ) : null}
      <Button type="button" variant="outline" onClick={exportCsv} disabled={empty}>
        <FileText />
        CSV
      </Button>
      <Button type="button" onClick={exportExcel} disabled={empty}>
        <FileSpreadsheet />
        Export Excel{empty ? "" : ` (${rows.length})`}
      </Button>

      {dialogOpen ? (
        <ExportColumnsDialog
          columns={columns}
          selected={selected}
          onChange={setSelected}
          onClose={() => setDialogOpen(false)}
          onApply={() => setDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
