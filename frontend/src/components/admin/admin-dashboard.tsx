import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActivityCard } from "./dashboard/activity-card";
import { DistributionCards } from "./dashboard/distribution-card";
import { KpiStrip } from "./dashboard/kpi-strip";
import { NeedsAttention } from "./dashboard/needs-attention";
import { PackagesCard } from "./dashboard/packages-card";
import { PipelineCard } from "./dashboard/pipeline-card";
import { QuickActions } from "./dashboard/quick-actions";
import { RecruitersCard } from "./dashboard/recruiters-card";
import { SeasonPicker } from "./dashboard/season-picker";
import type { AdminOverview, DashboardExtras } from "./dashboard/types";

export type { AdminOverview, DashboardExtras } from "./dashboard/types";

/**
 * The placement office's landing page. A server component: every section is a
 * plain rendering of data the page already fetched, and only the season picker
 * and the distribution tabs need the browser.
 */
export function AdminDashboard({
  overview,
  extras,
  backendError,
}: {
  overview: AdminOverview | null;
  extras: DashboardExtras;
  backendError: string | null;
}) {
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
          <AlertDescription>{backendError ?? "The dashboard is unavailable."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="admin-page dash">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Placement analytics</span>
          <h1>Placement dashboard</h1>
          <p>Offers, packages and pipeline for the selected season, with what needs doing next.</p>
        </div>
        <SeasonPicker season={overview.season} seasons={overview.seasons} />
      </section>

      <QuickActions actions={extras.actions} />

      {overview.season === null ? (
        <Alert variant="info" className="mt-4">
          <AlertDescription>
            No placement season exists yet. Add a job profile or a placement record to open one.
          </AlertDescription>
        </Alert>
      ) : (
        <KpiStrip overview={overview} />
      )}

      <NeedsAttention extras={extras} />

      {overview.season !== null ? (
        <>
          <section className="dash-grid" aria-label="Season analytics">
            <PipelineCard
              funnel={overview.applicationFunnel}
              season={overview.season}
              canRecordPlacements={extras.canRecordPlacements}
            />
            <RecruitersCard recruiters={overview.topRecruiters} />
            <PackagesCard packages={overview.packages} wide />
            <DistributionCards
              placementsByBranch={overview.placementsByBranch}
              placementsByDegree={overview.placementsByDegree}
              internshipsByDegree={overview.internshipsByDegree}
              internshipsByBranch={overview.internshipsByBranch ?? []}
              seasonStudents={overview.totals.seasonStudents}
            />
            <ActivityCard overview={overview} extras={extras} />
          </section>
          <p className="dash-foot center">
            Season figures are cached for up to five minutes. The attention panel above is read live.
          </p>
        </>
      ) : null}
    </div>
  );
}
