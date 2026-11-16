import { Download, ExternalLink, FileText } from "lucide-react";
import type { ReactNode } from "react";
import {
  COMPENSATION_DEGREES,
  SELECTION_ROUND_KEYS,
  SELECTION_ROUND_LABELS,
  WORK_MODE_LABELS,
  type CompensationEntry,
  type EventAttachment,
  type SelectionRound,
} from "@/lib/job-profile-schema";
import { formatFileSize, formatInr, hasText } from "@/lib/job-presenters";

/** A titled block that renders nothing when it has nothing to say. */
export function DetailSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="jd-section">
      <header>
        <h2>{title}</h2>
        {note ? <span>{note}</span> : null}
      </header>
      {children}
    </section>
  );
}

export type Row = { label: string; value: ReactNode };

/** Label / value rows; entries without a value are dropped, not shown blank. */
export function RowList({ rows }: { rows: (Row | null | false)[] }) {
  const present = rows.filter((row): row is Row => Boolean(row));
  if (!present.length) return null;
  return (
    <dl className="jd-rows">
      {present.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type KeyFact = { label: string; value: string };

export function KeyFacts({ facts }: { facts: KeyFact[] }) {
  if (!facts.length) return null;
  return (
    <dl className="jd-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function fileHref(jobId: string, key: string, download = false) {
  return `/api/company-events/${jobId}/files/${key}${download ? "?download=1" : ""}`;
}

export function FileCard({
  jobId,
  fileKey,
  file,
  title,
}: {
  jobId: string;
  fileKey: string;
  file: EventAttachment;
  title?: string;
}) {
  return (
    <li className="jd-file">
      <FileText aria-hidden />
      <div>
        <strong>{title ?? file.fileName}</strong>
        <span>
          {title ? `${file.fileName} · ` : ""}
          {formatFileSize(file.sizeBytes)}
        </span>
      </div>
      <a href={fileHref(jobId, fileKey)} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden />
        View
      </a>
      <a href={fileHref(jobId, fileKey, true)} download>
        <Download aria-hidden />
        Download
      </a>
    </li>
  );
}

export function CompensationTable({ compensation }: { compensation: Record<string, CompensationEntry> | null }) {
  if (!compensation) return null;
  const degrees = COMPENSATION_DEGREES.filter((degree) => compensation[degree]);
  if (!degrees.length) return null;
  const columns = (["fixed", "variable", "ctc"] as const).filter((column) =>
    degrees.some((degree) => compensation[degree]?.[column] != null),
  );
  const heading = { fixed: "Fixed", variable: "Variable", ctc: "Total CTC" };
  return (
    <div className="jd-table-wrap">
      <table className="jd-table">
        <thead>
          <tr>
            <th scope="col">Degree</th>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {heading[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {degrees.map((degree) => (
            <tr key={degree}>
              <th scope="row">{degree}</th>
              {columns.map((column) => {
                const amount = compensation[degree]?.[column];
                return <td key={column}>{amount == null ? "—" : formatInr(amount)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SelectionRounds({ rounds }: { rounds: Record<string, SelectionRound> | null }) {
  if (!rounds) return null;
  const present = SELECTION_ROUND_KEYS.filter((key) => rounds[key]);
  if (!present.length) return null;
  return (
    <ol className="jd-rounds">
      {present.map((key) => {
        const round = rounds[key];
        const detail = [
          round.rounds != null ? `${round.rounds} round${round.rounds === 1 ? "" : "s"}` : null,
          hasText(round.duration) ? round.duration : null,
          hasText(round.sequence) ? round.sequence : null,
        ].filter(Boolean);
        return (
          <li key={key} data-skipped={round.conducted === false || undefined}>
            <strong>{SELECTION_ROUND_LABELS[key]}</strong>
            <span>{round.conducted === false ? "Not conducted" : detail.join(" · ") || "Conducted"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export const yesNo = (value: boolean | null) => (value === null ? null : value ? "Yes" : "No");

export function workModeLabel(value: string | null) {
  return value ? WORK_MODE_LABELS[value as keyof typeof WORK_MODE_LABELS] ?? null : null;
}
