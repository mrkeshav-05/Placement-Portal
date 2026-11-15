"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Distribution } from "./types";

type Kind = "donut" | "columns";
type View = {
  key: string;
  tab: string;
  kind: Kind;
  caption: string;
  unit: string;
  empty: string;
  /** What the students outside every slice are called, e.g. "No internship offer". */
  restLabel: string;
  data: Distribution[];
};

/** Series colours, all from the palette tokens; the tail is a quiet neutral. */
const SERIES = [
  "var(--brand-600)",
  "var(--green)",
  "var(--orange)",
  "var(--brand-300)",
  "var(--brand-800)",
  "var(--brand-500)",
  "var(--muted)",
];
const colour = (index: number) => SERIES[Math.min(index, SERIES.length - 1)];

type Slice = Distribution & { index: number; share: number; rank: number };

/** Each slice's share is of the whole batch, not of the students shown. */
function toSlices(data: Distribution[], batch: number): { slices: Slice[]; counted: number; total: number } {
  const counted = data.reduce((sum, item) => sum + item.count, 0);
  const total = Math.max(batch, counted);
  return {
    counted,
    total,
    slices: data.map((item, index) => ({
      ...item,
      index,
      rank: index + 1,
      share: total ? (item.count / total) * 100 : 0,
    })),
  };
}

function Readout({ slice, total, unit }: { slice: Slice | null; total: number; unit: string }) {
  return (
    <p className="dash-readout" aria-live="polite">
      {slice ? (
        <>
          <b>{slice.label}</b>
          <span>
            {slice.count} {slice.count === 1 ? unit : `${unit}s`} · {slice.share.toFixed(1)}% of {total}
            {slice.rank > 0 ? ` · #${slice.rank}` : ""}
          </span>
        </>
      ) : (
        <span>Hover a segment for the breakdown</span>
      )}
    </p>
  );
}

function Donut({ data, unit, batch, restLabel }: { data: Distribution[]; unit: string; batch: number; restLabel: string }) {
  const { slices: grouped, counted, total } = toSlices(data, batch);
  // The students with no offer fill the rest of the ring, so it always sums to the batch.
  const rest = total - counted;
  const slices: Slice[] = rest > 0
    ? [...grouped, { label: restLabel, count: rest, index: grouped.length, rank: 0, share: (rest / total) * 100 }]
    : grouped;
  const [active, setActive] = useState<number | null>(null);
  const current = active === null ? null : slices[active];

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 1.6 : 0;
  // Where each segment starts along the ring, so the render below stays pure.
  const starts = slices.map((_, i) =>
    slices.slice(0, i).reduce((sum, item) => sum + (item.count / total) * circumference, 0),
  );

  return (
    <div className="dash-donut">
      <div className="dash-donut-ring">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${counted} of ${total} students`}>
          <circle cx="60" cy="60" r={radius} className="dash-donut-base" />
          {slices.map((slice) => {
            const length = Math.max(0, (slice.count / total) * circumference - gap);
            const start = starts[slice.index];
            return (
              <circle
                key={slice.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={slice.rank === 0 ? "var(--surface-highlight)" : colour(slice.index)}
                strokeWidth={active === slice.index ? 17 : 13}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-start}
                transform="rotate(-90 60 60)"
                className={active !== null && active !== slice.index ? "dim" : undefined}
                onMouseEnter={() => setActive(slice.index)}
                onMouseLeave={() => setActive(null)}
              >
                <title>{`${slice.label}: ${slice.count} (${slice.share.toFixed(1)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="dash-donut-centre">
          <strong>{current ? current.count : counted}</strong>
          <span>{current ? current.label : `of ${total} students`}</span>
        </div>
      </div>
      <ul className="dash-legend">
        {slices.map((slice) => (
          <li
            key={slice.label}
            className={active === slice.index ? "on" : active !== null ? "dim" : undefined}
            onMouseEnter={() => setActive(slice.index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(slice.index)}
            onBlur={() => setActive(null)}
            tabIndex={0}
          >
            <i style={{ background: slice.rank === 0 ? "var(--border)" : colour(slice.index) }} />
            <span>{slice.label}</span>
            <strong>{slice.count}</strong>
            <em>{slice.share.toFixed(1)}%</em>
          </li>
        ))}
      </ul>
      <Readout slice={current} total={total} unit={unit} />
    </div>
  );
}

function Columns({ data, unit, batch }: { data: Distribution[]; unit: string; batch: number }) {
  const { slices, total } = toSlices(data, batch);
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(...slices.map((slice) => slice.count));
  const current = active === null ? null : slices[active];

  return (
    <div className="dash-columns-wrap">
      <Readout slice={current} total={total} unit={unit} />
      <div className="dash-columns" role="list">
        {slices.map((slice) => (
          <button
            type="button"
            role="listitem"
            key={slice.label}
            className={active === slice.index ? "on" : active !== null ? "dim" : undefined}
            onMouseEnter={() => setActive(slice.index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(slice.index)}
            onBlur={() => setActive(null)}
            title={`${slice.label}: ${slice.count} (${slice.share.toFixed(1)}% of ${total})`}
          >
            <b>{slice.count}</b>
            <span className="dash-column-track">
              {/* Never invisible: one offer must stay visible beside a column many times its height. */}
              <i style={{ height: `${Math.max(4, (slice.count / peak) * 100)}%` }} />
            </span>
            <em>{slice.label}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function Chart({ view, batch }: { view: View; batch: number }) {
  if (!view.data.length) return <p className="dash-empty">{view.empty}</p>;
  return view.kind === "donut" ? (
    <Donut data={view.data} unit={view.unit} batch={batch} restLabel={view.restLabel} />
  ) : (
    <Columns data={view.data} unit={view.unit} batch={batch} />
  );
}

function Card({ title, views, batch }: { title: string; views: View[]; batch: number }) {
  // Open on the first view that has something to show rather than on a blank one.
  const initial = views.find((view) => view.data.length)?.key ?? views[0].key;
  return (
    <article className="dash-card">
      <Tabs defaultValue={initial}>
        <header className="dash-card-head">
          <div>
            <h2>{title}</h2>
          </div>
          <TabsList>
            {views.map((view) => (
              <TabsTrigger key={view.key} value={view.key}>
                {view.tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </header>
        {views.map((view) => (
          <TabsContent key={view.key} value={view.key}>
            <p className="dash-caption">{view.caption}</p>
            <Chart view={view} batch={batch} />
          </TabsContent>
        ))}
      </Tabs>
    </article>
  );
}

/** Internship offers, above the full-time/PPO placements. Each card follows its data. */
export function DistributionCards({
  placementsByBranch,
  placementsByDegree,
  internshipsByDegree,
  internshipsByBranch,
  seasonStudents,
}: {
  placementsByBranch: Distribution[];
  placementsByDegree: Distribution[];
  internshipsByDegree: Distribution[];
  internshipsByBranch: Distribution[];
  /** Students in the season's batch: the whole every share is measured against. */
  seasonStudents: number;
}) {
  return (
    <div className="dash-stack">
      <Card
        title="Internship distribution"
        batch={seasonStudents}
        views={[
          {
            key: "degree",
            tab: "By degree",
            kind: "donut",
            unit: "student",
            caption: "Students holding an internship offer, by degree, out of the whole batch",
            restLabel: "No internship offer",
            empty: "No internship offers recorded for this season.",
            data: internshipsByDegree,
          },
          {
            key: "branch",
            tab: "By branch",
            kind: "columns",
            unit: "student",
            caption: "Students holding an internship offer, by branch, out of the whole batch",
            restLabel: "No internship offer",
            empty: "Branch figures appear once internship offers are recorded.",
            data: internshipsByBranch,
          },
        ]}
      />
      <Card
        title="Placement distribution"
        batch={seasonStudents}
        views={[
          {
            key: "branch",
            tab: "By branch",
            kind: "columns",
            unit: "student",
            caption: "Students placed (full-time or PPO), by branch, out of the whole batch",
            restLabel: "Not placed yet",
            empty: "Branch figures appear once the season's offers are recorded.",
            data: placementsByBranch,
          },
          {
            key: "degree",
            tab: "By degree",
            kind: "donut",
            unit: "student",
            caption: "Students placed (full-time or PPO), by degree, out of the whole batch",
            restLabel: "Not placed yet",
            empty: "No placement offers recorded for this season.",
            data: placementsByDegree,
          },
        ]}
      />
    </div>
  );
}
