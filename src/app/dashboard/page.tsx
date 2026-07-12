import { DashboardFeed } from "@/components/dashboard/dashboard-feed";
import { PortalShell } from "@/components/layout/portal-shell";

export default function DashboardPage() {
  return <PortalShell><DashboardFeed /></PortalShell>;
}
