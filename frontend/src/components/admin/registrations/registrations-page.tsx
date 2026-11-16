"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Rocket, Users } from "lucide-react";
import { RecordPlacementDialog } from "@/components/admin/record-placement-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationsTable } from "./applications-table";
import { RegistrationsTable } from "./registrations-table";
import { ScopeBar } from "./scope-bar";
import { StageSummary } from "./stage-summary";
import type { AdminApplicationRow, JobOption } from "./types";

export type RegistrationsTab = "registrations" | "manage";

type Message = { type: "success" | "error"; text: string };
type Patch = Partial<Pick<AdminApplicationRow, "status" | "offerId">>;

/**
 * Event registrations, in one place: pick an event once, then either read and
 * export who registered, or move those students through the stages. Both tabs
 * stay mounted, so a search or filter survives switching between them.
 */
export function RegistrationsPage({
  applications,
  jobs,
  eventId,
  initialTab,
  canUpdate,
  truncatedAt,
}: {
  applications: AdminApplicationRow[];
  jobs: JobOption[];
  eventId: string | null;
  initialTab: RegistrationsTab;
  canUpdate: boolean;
  /** Set when the list hit its cap, so the screen can say it is not showing everything. */
  truncatedAt: number | null;
}) {
  const router = useRouter();
  const [loading, startNavigation] = useTransition();
  const [tab, setTab] = useState<RegistrationsTab>(initialTab);
  const [message, setMessage] = useState<Message | null>(null);
  const [placementRow, setPlacementRow] = useState<AdminApplicationRow | null>(null);
  // Local edits made since the server last sent rows, tagged with the event
  // they were made under so they never leak onto another event's list.
  const [patches, setPatches] = useState<{ scope: string | null; byId: Record<string, Patch> }>({
    scope: eventId,
    byId: {},
  });

  const rows = useMemo(() => {
    const byId = patches.scope === eventId ? patches.byId : {};
    return applications.map((row) => (byId[row.id] ? { ...row, ...byId[row.id] } : row));
  }, [applications, patches, eventId]);

  const job = jobs.find((item) => item.id === eventId) ?? null;

  function selectEvent(next: string | null) {
    setMessage(null);
    const query = new URLSearchParams();
    if (next) query.set("event", next);
    if (tab !== "registrations") query.set("tab", tab);
    startNavigation(() => router.push(`/admin/applications${query.size ? `?${query}` : ""}`));
  }

  function selectTab(next: string) {
    const value = next as RegistrationsTab;
    setTab(value);
    // The address follows the tab without a server round trip, so a copied
    // link opens on the same tab.
    const query = new URLSearchParams(window.location.search);
    if (value === "registrations") query.delete("tab");
    else query.set("tab", value);
    window.history.replaceState(null, "", `/admin/applications${query.size ? `?${query}` : ""}`);
  }

  function applyPatch(ids: string[], patch: Patch) {
    setPatches((current) => {
      const byId = current.scope === eventId ? { ...current.byId } : {};
      for (const id of ids) byId[id] = { ...byId[id], ...patch };
      return { scope: eventId, byId };
    });
  }

  return (
    <div className="admin-page">
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Recruitment</span>
          <h1>Event registrations</h1>
          <p>Choose an event, then review who registered and move students through the stages.</p>
        </div>
      </section>

      <ScopeBar jobs={jobs} eventId={eventId} onEventChange={selectEvent} />

      <StageSummary rows={rows} />

      {message ? (
        <Alert variant={message.type === "success" ? "success" : "destructive"} className="mb-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={selectTab} className="reg-tabs" aria-busy={loading}>
        <TabsList>
          <TabsTrigger value="registrations">
            <Users />
            Registrations
            {eventId ? <Badge variant="secondary">{rows.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="manage">
            <ClipboardList />
            Manage applications
            <Badge variant="secondary">{rows.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrations" forceMount className="data-[state=inactive]:hidden">
          {eventId ? (
            <RegistrationsTable key={eventId} rows={rows} job={job} onMessage={setMessage} />
          ) : (
            <div className="reg-empty">
              <Rocket />
              <h3>Choose an event</h3>
              <p>Pick a season, company and event above to see who registered and export the list.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manage" forceMount className="data-[state=inactive]:hidden">
          {!eventId && truncatedAt ? (
            <p className="reg-note">
              Showing the latest {truncatedAt} applications across all events. Choose an event to see everyone who applied.
            </p>
          ) : null}
          {!canUpdate ? (
            <p className="reg-note">You can view applications but not change their stage.</p>
          ) : null}
          <ApplicationsTable
            key={eventId ?? "all"}
            rows={rows}
            job={job}
            jobs={jobs}
            canUpdate={canUpdate}
            onPatch={applyPatch}
            onMessage={setMessage}
            onRecordPlacement={setPlacementRow}
          />
        </TabsContent>
      </Tabs>

      {placementRow ? (
        <RecordPlacementDialog
          application={placementRow}
          onClose={() => setPlacementRow(null)}
          onSaved={() => {
            setPlacementRow(null);
            setMessage({ type: "success", text: "Placement record saved." });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
