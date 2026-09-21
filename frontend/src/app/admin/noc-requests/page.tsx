import { AuthenticatedAdminShell } from "@/components/admin/authenticated-admin-shell";
import { NocRequestsManager, type AdminNocItem } from "@/components/admin/noc-requests-manager";
import { requirePermission } from "@/lib/admin-session";
import { backendFetch } from "@/lib/api-client";
import { db } from "@/lib/db";
import { hasPermission, PERM_NOC_APPROVE, PERM_NOC_VIEW } from "@/lib/permissions";

interface BackendNocAdminDto {
  id: string;
  userId: string;
  company: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  startDate: string;
  endDate: string;
  status: string;
  message?: string | null;
  adminRemarks?: string | null;
  documentUrl?: string | null;
  source: string;
  offCampusProofUrl?: string | null;
  verifiedByPlacementTeam: boolean;
  nocRequired: boolean;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    name?: string | null;
    email?: string | null;
    rollNumber?: string | null;
    branch?: string | null;
    batch?: number | null;
    degree?: string | null;
    cgpa?: number | null;
    contactNumber?: string | null;
  } | null;
}

export const dynamic = "force-dynamic";

export default async function Page() {
  const { user } = await requirePermission(PERM_NOC_VIEW);

  let items: AdminNocItem[] = [];

  try {
    const rawData = await backendFetch<BackendNocAdminDto[]>("/api/v1/noc/admin");
    items = rawData.map((noc) => ({
      id: noc.id,
      userId: noc.userId,
      studentName: noc.student?.name ?? null,
      studentEmail: noc.student?.email ?? null,
      rollNumber: noc.student?.rollNumber ?? null,
      branch: noc.student?.branch ?? null,
      batch: noc.student?.batch ?? null,
      degree: noc.student?.degree ?? null,
      cgpa: noc.student?.cgpa ?? null,
      contactNumber: noc.student?.contactNumber ?? null,
      company: noc.company,
      address: noc.address,
      city: noc.city,
      state: noc.state,
      pincode: noc.pincode,
      startDate: typeof noc.startDate === "string" ? noc.startDate : new Date(noc.startDate).toISOString(),
      endDate: typeof noc.endDate === "string" ? noc.endDate : new Date(noc.endDate).toISOString(),
      status: noc.status,
      message: noc.message ?? null,
      adminRemarks: noc.adminRemarks ?? null,
      documentUrl: noc.documentUrl ?? null,
      source: noc.source,
      offCampusProofUrl: noc.offCampusProofUrl ?? null,
      verifiedByPlacementTeam: noc.verifiedByPlacementTeam,
      nocRequired: noc.nocRequired,
      createdAt: typeof noc.createdAt === "string" ? noc.createdAt : new Date(noc.createdAt).toISOString(),
      updatedAt: typeof noc.updatedAt === "string" ? noc.updatedAt : new Date(noc.updatedAt).toISOString(),
    }));
  } catch {
    // Prisma fallback. FACULTY only ever sees APPROVED requests — the
    // backend enforces this in list_admin_nocs, so it has to be mirrored
    // here too, or a backend outage would show a read-only role rows it
    // should never see.
    const records = await db.nocRequest.findMany({
      where: user.role === "FACULTY" ? { status: "APPROVED" } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            rollNumber: true,
            branch: true,
            batch: true,
            degree: true,
            cgpa: true,
            contactNumber: true,
          },
        },
      },
    });

    items = records.map((noc) => ({
      id: noc.id,
      userId: noc.userId,
      studentName: noc.user?.name ?? null,
      studentEmail: noc.user?.email ?? null,
      rollNumber: noc.user?.rollNumber ?? null,
      branch: noc.user?.branch ?? null,
      batch: noc.user?.batch ?? null,
      degree: noc.user?.degree ?? null,
      cgpa: noc.user?.cgpa ?? null,
      contactNumber: noc.user?.contactNumber ?? null,
      company: noc.company,
      address: noc.address,
      city: noc.city,
      state: noc.state,
      pincode: noc.pincode,
      startDate: noc.startDate.toISOString(),
      endDate: noc.endDate.toISOString(),
      status: noc.status,
      message: noc.message,
      adminRemarks: noc.adminRemarks,
      documentUrl: noc.documentUrl,
      source: noc.source,
      offCampusProofUrl: noc.offCampusProofUrl,
      verifiedByPlacementTeam: noc.verifiedByPlacementTeam,
      nocRequired: noc.nocRequired,
      createdAt: noc.createdAt.toISOString(),
      updatedAt: noc.updatedAt.toISOString(),
    }));
  }

  // A Placement Volunteer can view every request but not decide on one (see
  // PLACEMENT_VOLUNTEER_DEFAULTS in permissions.ts); the decision status is
  // therefore an admin-only column, not something a volunteer needs to see.
  const canDecide = hasPermission(user, PERM_NOC_APPROVE);

  return (
    <AuthenticatedAdminShell>
      <NocRequestsManager nocRequests={items} canPersist={Boolean(user?.id)} canDecide={canDecide} />
    </AuthenticatedAdminShell>
  );
}

