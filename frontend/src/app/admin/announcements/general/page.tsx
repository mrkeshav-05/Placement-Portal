import Link from "next/link";
import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { AnnouncementComposer } from "@/components/admin/announcement-composer";
import { RecentAnnouncements } from "@/components/admin/recent-announcements";
import { requirePermission } from "@/lib/admin-session";
import { PERM_ANNOUNCEMENTS_CREATE } from "@/lib/permissions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePermission(PERM_ANNOUNCEMENTS_CREATE);

  const recent = await db.announcement.findMany({
    where: { category: "GENERAL" },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <AuthenticatedAdminShell>
      <div className="admin-page composer-page">
        <section className="admin-heading">
          <div>
            <span className="eyebrow">Communications &amp; drives</span>
            <h1>General announcement</h1>
            <p>An institute-wide notice: policy, deadlines, and placement guidelines.</p>
          </div>
          <Link href="/admin/announcements">Active &amp; drafts</Link>
        </section>

        {/* A general notice belongs to no company and no drive, so the composer
            opens straight at the tag and the title. */}
        <AnnouncementComposer category="GENERAL" companies={[]} events={[]} seasons={[]} />

        <RecentAnnouncements
          heading="Recent general announcements"
          items={recent.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            companyName: null,
            tags: item.tags,
            createdAt: item.createdAt.toISOString(),
          }))}
        />
      </div>
    </AuthenticatedAdminShell>
  );
}
