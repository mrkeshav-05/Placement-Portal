import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { SettingsManager } from "@/components/admin/settings-manager";
import { requirePermission } from "@/lib/admin-session";
import { PERM_SETTINGS_MANAGE } from "@/lib/permissions";
import { configuredAdminEmails } from "@/lib/auth-access";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user: currentAdmin } = await requirePermission(PERM_SETTINGS_MANAGE);

  const [superAdmins, placementTeam, placementVolunteers, faculty, students, total] = await Promise.all([
    db.user.count({ where: { role: "SUPER_ADMIN" } }),
    db.user.count({ where: { role: "PLACEMENT_TEAM" } }),
    db.user.count({ where: { role: "PLACEMENT_VOLUNTEER" } }),
    db.user.count({ where: { role: "FACULTY" } }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count(),
  ]);

  const adminEmails = Array.from(configuredAdminEmails());

  return (
    <AuthenticatedAdminShell>
      <SettingsManager
        userCounts={{
          superAdmins,
          placementTeam,
          placementVolunteers,
          faculty,
          students,
          total,
        }}
        adminEmails={adminEmails}
        currentAdminEmail={currentAdmin.email}
      />
    </AuthenticatedAdminShell>
  );
}
