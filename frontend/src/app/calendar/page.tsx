import { AuthenticatedPortalShell } from "@/components/layout/authenticated-portal-shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { backendFetch } from "@/lib/api-client";
import type { BackendCalendarEvent } from "@/lib/backend-types";
import { parseCalendarParams, rangeQuery } from "@/lib/calendar-utils";
import { requireStudent } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { user } = await requireStudent();
  const { view, anchor } = parseCalendarParams(await searchParams);
  const { from, to } = rangeQuery(view, anchor);

  let events: BackendCalendarEvent[] = [];
  let backendError: string | null = null;
  try {
    const query = new URLSearchParams({ from, to });
    events = await backendFetch<BackendCalendarEvent[]>(`/api/v1/calendar/events?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to load the student calendar from the backend", error);
    backendError = "Your calendar could not be loaded right now. Try again in a moment.";
  }

  return (
    <AuthenticatedPortalShell>
      <div className="module-page !max-w-[1280px] lg:flex lg:h-[calc(100svh-76px)] lg:flex-col lg:!py-5">
        <section className="page-heading mb-4 lg:mb-3 lg:[&_h1]:my-1 lg:[&_h1]:text-[26px]">
          <div>
            <span className="eyebrow">Placement calendar</span>
            <h1>My calendar</h1>
            <p>
              Drives the placement team has shared with you, your interview slots, and reminders you add
              yourself.
            </p>
          </div>
        </section>
        <CalendarView
          mode="student"
          view={view}
          anchor={anchor}
          events={events}
          options={null}
          currentUserId={user.id}
          canCreateShared={false}
          fit
          backendError={backendError}
        />
      </div>
    </AuthenticatedPortalShell>
  );
}
