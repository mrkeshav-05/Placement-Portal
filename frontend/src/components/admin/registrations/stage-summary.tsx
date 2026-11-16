import type { AdminApplicationRow } from "./types";

/** Where the applications of the chosen scope stand, at a glance. */
export function StageSummary({ rows }: { rows: AdminApplicationRow[] }) {
  const count = (...statuses: AdminApplicationRow["status"][]) =>
    rows.filter((row) => statuses.includes(row.status)).length;
  const items = [
    { label: "Registered", value: rows.length },
    { label: "Shortlisted", value: count("SHORTLISTED") },
    { label: "Assessment / Interview", value: count("INTERVIEW") },
    { label: "Selected", value: count("SELECTED", "OFFER_ACCEPTED") },
    { label: "Not selected", value: count("REJECTED") },
  ];
  return (
    <dl className="reg-summary" aria-label="Application stages">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
