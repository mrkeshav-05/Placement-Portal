"use client";

import {
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  GraduationCap,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRupees, formatStipend } from "@/lib/offer-schema";

export type AmountStats = {
  count: number;
  average: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
};

export type Distribution = { label: string; count: number };

export type AdminOverview = {
  season: number | null;
  seasons: number[];
  totals: {
    students: number;
    seasonStudents: number;
    companies: number;
    activeJobs: number;
    placements: number;
    internships: number;
    placedStudents: number;
    placementRate: number;
    recruiters: number;
  };
  packages: {
    placement: AmountStats;
    ppo: AmountStats;
    combined: AmountStats;
    internship: AmountStats;
  };
  placementsByDegree: Distribution[];
  internshipsByDegree: Distribution[];
  placementsByBranch: Distribution[];
  topRecruiters: Distribution[];
  applicationFunnel: { total: number; shortlisted: number; interviews: number; selected: number };
  recentApplications: Array<{
    id: string;
    student: string;
    role: string;
    company: string;
    status: string;
    updatedAt: string | null;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function ColumnChart({
  data,
  emptyMessage,
  tone,
}: {
  data: Distribution[];
  emptyMessage: string;
  tone?: "accent";
}) {
  if (!data.length) return <p className="chart-empty">{emptyMessage}</p>;

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const peak = Math.max(...data.map((item) => item.count));

  return (
    <div className={`column-chart${tone === "accent" ? " accent" : ""}`}>
      {data.map((item) => (
        <div
          key={item.label}
          className="column"
          title={`${item.label}: ${item.count} (${Math.round((item.count / total) * 100)}%)`}
        >
          <b>{item.count}</b>
          {/* A bar is never invisible: a single offer still has to be clickable
              and readable next to a bar twenty times its size. */}
          <i style={{ height: `${Math.max(6, (item.count / peak) * 100)}%` }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function PackageCard({
  title,
  icon,
  stats,
  monthly,
}: {
  title: string;
  icon: React.ReactNode;
  stats: AmountStats;
  /** Internship stipends are monthly, so they never read as LPA. */
  monthly?: boolean;
}) {
  const format = monthly ? formatStipend : formatRupees;

  return (
    <article className="package-card">
      <header>
        <h2>{title}</h2>
        {icon}
      </header>
      <dl>
        <div>
          <dt>Average</dt>
          <dd>{format(stats.average)}</dd>
        </div>
        <div>
          <dt>Median</dt>
          <dd>{format(stats.median)}</dd>
        </div>
        <div>
          <dt>Highest</dt>
          <dd className="highlight">{format(stats.highest)}</dd>
        </div>
      </dl>
      <small>
        {stats.count
          ? `From ${stats.count} recorded ${stats.count === 1 ? "offer" : "offers"}`
          : "No offers recorded for this season"}
      </small>
    </article>
  );
}

export function AdminDashboard({
  overview,
  backendError,
}: {
  overview: AdminOverview | null;
  backendError: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!overview) {
    return (
      <div className="admin-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Placement analytics</span>
            <h1>Placement dashboard</h1>
          </div>
        </section>
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            {backendError ?? "The dashboard is unavailable."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { totals, packages, applicationFunnel: funnel } = overview;
  const funnelTotal = funnel.total || 0;
  const pct = (count: number) => (funnelTotal > 0 ? Math.round((count / funnelTotal) * 100) : 0);

  function selectSeason(season: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", season);
    router.push(`/admin/dashboard?${params.toString()}`);
  }

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Placement analytics</span>
          <h1>Placement dashboard</h1>
          <p>Offers, packages, and pipeline for the selected placement season.</p>
        </div>
        <div className="season-picker">
          <CalendarRange />
          <span>Season</span>
          <Select
            value={overview.season === null ? "" : String(overview.season)}
            onValueChange={selectSeason}
            disabled={!overview.seasons.length}
          >
            <SelectTrigger
              aria-label="Placement season"
              // `.admin-heading button` paints every button in a page heading
              // as a filled navy pill. The trigger opts out of it so the
              // surrounding picker stays the visible control.
              className="h-auto rounded-none bg-transparent p-0 text-[13px] font-extrabold text-[var(--ink)] normal-case shadow-none hover:transform-none focus-visible:ring-0"
            >
              <SelectValue placeholder="No seasons yet" />
            </SelectTrigger>
            <SelectContent>
              {overview.seasons.map((season) => (
                <SelectItem key={season} value={String(season)}>
                  {season}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {overview.season === null ? (
        <Alert variant="info" className="mt-4">
          <AlertDescription>
            No placement season exists yet. Add a job profile or a placement record to open one.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="admin-metrics">
        <article>
          <span className="metric-icon blue">
            <GraduationCap />
          </span>
          <div>
            <small>Total placements</small>
            <strong>{totals.placements}</strong>
            <b>
              {totals.placedStudents} placed of {totals.seasonStudents} students ·{" "}
              {totals.placementRate}%
            </b>
          </div>
        </article>
        <article>
          <span className="metric-icon green">
            <BriefcaseBusiness />
          </span>
          <div>
            <small>Total internships</small>
            <strong>{totals.internships}</strong>
            <b>{formatStipend(packages.internship.average)} average stipend</b>
          </div>
        </article>
        <article>
          <span className="metric-icon orange">
            <TrendingUp />
          </span>
          <div>
            <small>Average package</small>
            <strong>{formatRupees(packages.combined.average)}</strong>
            <b>Median {formatRupees(packages.combined.median)}</b>
          </div>
        </article>
        <article>
          <span className="metric-icon violet">
            <Award />
          </span>
          <div>
            <small>Highest package</small>
            <strong>{formatRupees(packages.combined.highest)}</strong>
            <b>
              {totals.recruiters} recruiters · {totals.activeJobs} active drives
            </b>
          </div>
        </article>
      </section>

      <section className="analytics-grid">
        <article>
          <header>
            <div>
              <h2>Placements by degree</h2>
              <p>Full-time and pre-placement offers across degree programmes</p>
            </div>
            <GraduationCap />
          </header>
          <ColumnChart
            data={overview.placementsByDegree}
            emptyMessage="No placement offers recorded for this season."
          />
        </article>

        <article>
          <header>
            <div>
              <h2>Internships by degree</h2>
              <p>Internship offers across degree programmes</p>
            </div>
            <Building2 />
          </header>
          <ColumnChart
            data={overview.internshipsByDegree}
            emptyMessage="No internship offers recorded for this season."
            tone="accent"
          />
        </article>
      </section>

      <section className="analytics-grid single">
        <article>
          <header>
            <div>
              <h2>Placements by branch</h2>
              <p>Offers held by students of each branch</p>
            </div>
            <Users />
          </header>
          <ColumnChart
            data={overview.placementsByBranch}
            emptyMessage="Branch figures appear once the season's offers are recorded."
          />
        </article>
      </section>

      <section className="package-grid">
        <PackageCard
          title="Placement packages"
          icon={<TrendingUp />}
          stats={packages.placement}
        />
        <PackageCard title="PPO packages" icon={<Award />} stats={packages.ppo} />
        <PackageCard title="All placements" icon={<Target />} stats={packages.combined} />
        <PackageCard
          title="Internship stipends"
          icon={<BriefcaseBusiness />}
          stats={packages.internship}
          monthly
        />
      </section>

      <section className="analytics-grid">
        <article>
          <header>
            <div>
              <h2>Application funnel</h2>
              <p>Applications to this season&apos;s drives, by stage</p>
            </div>
            <BriefcaseBusiness />
          </header>
          <div className="funnel">
            {(
              [
                ["Applications", funnel.total, "stage-total"],
                ["Shortlisted", funnel.shortlisted, "stage-shortlisted"],
                ["Interviewed", funnel.interviews, "stage-interview"],
                ["Selected", funnel.selected, "stage-selected"],
              ] as const
            ).map(([label, count, stage]) => (
              <div className={`funnel-row ${stage}`} key={label}>
                <div className="funnel-row-header">
                  <div className="funnel-stage">
                    <span className="funnel-stage-indicator" />
                    <span>{label}</span>
                  </div>
                  <div className="funnel-stat">
                    <strong className="funnel-count">{count}</strong>
                    <span className="funnel-percent">{pct(count)}%</span>
                  </div>
                </div>
                <div className="funnel-track">
                  <div
                    className="funnel-bar"
                    style={{ width: `${count > 0 ? Math.max(6, pct(count)) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article>
          <header>
            <div>
              <h2>Top recruiters</h2>
              <p>Companies by offers made this season</p>
            </div>
            <Building2 />
          </header>
          {overview.topRecruiters.length ? (
            <div className="bar-chart">
              {overview.topRecruiters.map((item) => {
                const peak = overview.topRecruiters[0]?.count || 1;
                return (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <i>
                      <b style={{ width: `${Math.max(6, (item.count / peak) * 100)}%` }} />
                    </i>
                    <strong>{item.count}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="chart-empty">No offers recorded for this season.</p>
          )}
        </article>
      </section>

      <section className="recent-admin">
        <header>
          <div>
            <h2>Recent applications</h2>
            <p>Latest submissions and status changes in this season</p>
          </div>
        </header>
        {overview.recentApplications.length ? (
          overview.recentApplications.map((application) => (
            <div key={application.id}>
              <i />
              <span>
                <strong>
                  {application.student} · {application.company} · {application.role}
                </strong>
                <small>
                  {application.status} ·{" "}
                  {application.updatedAt ? dateFormatter.format(new Date(application.updatedAt)) : "—"}
                </small>
              </span>
            </div>
          ))
        ) : (
          <div className="admin-empty compact">
            <BriefcaseBusiness />
            <h2>No applications yet</h2>
            <p>New student applications will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
