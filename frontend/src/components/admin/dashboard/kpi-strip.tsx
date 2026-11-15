import Link from "next/link";
import { formatRupees } from "@/lib/offer-schema";
import type { AdminOverview } from "./types";

type Kpi = {
  label: string;
  value: string;
  detail: string;
  /** Optional 0-100 fill for a thin progress rule under the value. */
  progress?: number;
  href?: string;
  tone?: "warn";
  /** Long text values (a company name) truncate instead of wrapping the tile. */
  text?: boolean;
  /** Shown on hover or keyboard focus: how the figure is worked out. */
  pop?: { rows?: Array<[string, string]>; note: string };
};

/** Stipends are monthly rupees, so they never read as LPA. */
function rupeesPerMonth(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function internshipKpis(overview: AdminOverview): Kpi[] {
  const { totals, packages, internshipSummary: summary, internshipsByDegree } = overview;
  const stipend = packages.internship;
  const rate = totals.seasonStudents
    ? Math.round((summary.studentsWithOffers / totals.seasonStudents) * 100)
    : 0;

  return [
    {
      label: "Students with offers",
      value: `${summary.studentsWithOffers} / ${totals.seasonStudents}`,
      detail: `${rate}% of the ${overview.season} batch hold an internship offer`,
      progress: rate,
      pop: {
        rows: internshipsByDegree.slice(0, 5).map((d) => [d.label, String(d.count)]),
        note: `${plural(totals.internships, "internship offer")} on file, by student degree. Updates when an internship offer is recorded or revoked.`,
      },
    },
    {
      label: "Median stipend",
      value: stipend.count ? `${rupeesPerMonth(stipend.median)}/mo` : "—",
      detail: stipend.count
        ? `Average ${rupeesPerMonth(stipend.average)}/month · ${stipend.count} with a stipend`
        : "No stipend recorded",
      pop: {
        rows: stipend.count
          ? [
              ["Median", `${rupeesPerMonth(stipend.median)}/mo`],
              ["Average", `${rupeesPerMonth(stipend.average)}/mo`],
              ["Lowest", `${rupeesPerMonth(stipend.lowest)}/mo`],
            ]
          : undefined,
        note: "Calculated from internship offers that carry a monthly stipend.",
      },
    },
    {
      label: "Highest stipend",
      value: stipend.count ? `${rupeesPerMonth(stipend.highest)}/mo` : "—",
      detail: stipend.count
        ? `Lowest ${rupeesPerMonth(stipend.lowest)}/month`
        : "Appears once a stipend is recorded",
    },
    {
      label: "Students eligible",
      value: String(summary.eligibleStudents),
      detail: "No offer yet, still open to recruiters",
      pop: {
        rows: [
          ["Batch size", String(totals.seasonStudents)],
          ["Holding an offer", String(totals.seasonStudents - summary.eligibleStudents)],
          ["Eligible", String(summary.eligibleStudents)],
        ],
        note: "A student leaves this count as soon as any internship, full-time or PPO offer is recorded for them.",
      },
    },
    {
      label: "Top recruiter",
      value: summary.topRecruiter ? summary.topRecruiter.label : "—",
      detail: summary.topRecruiter
        ? `${plural(summary.topRecruiter.count, "internship offer")}`
        : "No internship offers yet",
      text: true,
      pop: summary.recruiters.length
        ? {
            rows: summary.recruiters.map((r) => [r.label, plural(r.count, "offer")]),
            note: "Companies ranked by internship offers this season.",
          }
        : undefined,
    },
  ];
}

function placementKpis(overview: AdminOverview): Kpi[] {
  const { totals, packages, live, conversion } = overview;
  const pastDeadline = Math.max(0, totals.activeJobs - live.openDrives);

  return [
    {
      label: "Students placed",
      value: `${totals.placedStudents} / ${totals.seasonStudents}`,
      detail: `${totals.placementRate}% of the ${overview.season} batch · ${totals.placements} full-time or PPO ${
        totals.placements === 1 ? "offer" : "offers"
      }`,
      progress: totals.placementRate,
      pop: {
        rows: overview.placementsByDegree.slice(0, 5).map((d) => [d.label, String(d.count)]),
        note: "Students holding a full-time or PPO offer, by degree. Updates when such an offer is recorded.",
      },
    },
    {
      label: "Median / average package",
      value: formatRupees(packages.combined.median),
      detail: packages.combined.count
        ? `Average ${formatRupees(packages.combined.average)} · ${packages.combined.count} with a recorded CTC`
        : "No full-time or PPO CTC recorded",
    },
    {
      label: "Highest package",
      value: formatRupees(packages.combined.highest),
      detail: packages.combined.count
        ? `Lowest ${formatRupees(packages.combined.lowest)} · ${totals.placementRecruiters} ${
            totals.placementRecruiters === 1 ? "recruiter" : "recruiters"
          } hiring`
        : "Appears once a CTC is recorded",
    },
    {
      label: "Interns converted to full-time",
      value: String(conversion.converted),
      detail: conversion.interns
        ? `${conversion.rate}% of ${plural(conversion.interns, "intern")} received a full-time offer`
        : "No internship offers to convert yet",
      progress: conversion.interns ? conversion.rate : undefined,
      pop: {
        rows: [
          ["Students who interned", String(conversion.interns)],
          ["Converted", String(conversion.converted)],
          ["PPO with no internship on file", String(conversion.ppoWithoutInternship)],
        ],
        note: "Counts a PPO, or a full-time offer from the company the student interned at. Worked out from the offers on file, so nothing needs flagging by hand.",
      },
    },
    {
      label: "Drives open",
      value: String(live.openDrives),
      detail:
        pastDeadline > 0
          ? `${pastDeadline} more marked active but past deadline`
          : `${totals.companies} companies on record`,
      href: "/admin/events",
      tone: pastDeadline > 0 && live.openDrives === 0 ? "warn" : undefined,
    },
  ];
}

function KpiRow({ title, kpis }: { title: string; kpis: Kpi[] }) {
  return (
    <section className="dash-kpi-group" aria-label={title}>
      <h2 className="dash-kpi-title">{title}</h2>
      <div className="dash-kpis">
        {kpis.map((kpi) => {
          const body = (
            <>
              <small>{kpi.label}</small>
              <strong className={kpi.text ? "text" : undefined} title={kpi.text ? kpi.value : undefined}>
                {kpi.value}
              </strong>
              {kpi.progress !== undefined ? (
                <span className="dash-kpi-rule" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, Math.max(0, kpi.progress))}%` }} />
                </span>
              ) : null}
              <span className={`dash-kpi-detail${kpi.tone === "warn" ? " warn" : ""}`}>{kpi.detail}</span>
              {kpi.pop ? (
                <span className="dash-kpi-pop" role="tooltip">
                  {kpi.pop.rows?.length ? (
                    <dl>
                      {kpi.pop.rows.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <em>{kpi.pop.note}</em>
                </span>
              ) : null}
            </>
          );
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href} className="dash-kpi link">
              {body}
            </Link>
          ) : (
            <div key={kpi.label} className={`dash-kpi${kpi.pop ? " has-pop" : ""}`} tabIndex={kpi.pop ? 0 : undefined}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function KpiStrip({ overview }: { overview: AdminOverview }) {
  return (
    <>
      <KpiRow title="Internship statistics" kpis={internshipKpis(overview)} />
      <KpiRow title="Placement statistics" kpis={placementKpis(overview)} />
    </>
  );
}
