"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { PERM_APPLICATIONS_UPDATE } from "@/lib/permissions";
import { db } from "@/lib/db";
import type { ApplicationStatus } from "@prisma/client";
import { ADMIN_ONLY_STATUSES } from "@/lib/application-status";

/**
 * A failed `fetch` (API down) is a TypeError; an HTTP error arrives as a plain
 * Error carrying the response body. Only the first may fall back to Prisma:
 * falling back on a 403 let an account without `applications.update` write
 * through the database and skip the offer sync, email and cache invalidation.
 */
function isBackendUnreachable(error: unknown) {
  return error instanceof TypeError;
}

function backendMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    try {
      const detail = JSON.parse(error.message)?.detail;
      if (typeof detail === "string" && detail) return detail;
    } catch {
      // Not JSON: keep the fallback rather than echo a stack of raw text.
    }
  }
  return fallback;
}

/** Offer decisions are placement-cell bookkeeping; a student is never told of them. */
const notifiesStudent = (status: ApplicationStatus) => !ADMIN_ONLY_STATUSES.includes(status);

const validStatuses = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "WITHDRAWN",
] as const;

const updateStatusSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(validStatuses),
});

const bulkUpdateSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1),
  status: z.enum(validStatuses),
});

export type AdminApplicationActionState = {
  success?: string;
  error?: string;
};

export async function updateApplicationStatusAction(
  applicationId: string,
  newStatus: ApplicationStatus,
): Promise<AdminApplicationActionState> {
  const parsed = updateStatusSchema.safeParse({ applicationId, status: newStatus });
  if (!parsed.success) return { error: "Invalid status or application ID." };

  await requirePermission(PERM_APPLICATIONS_UPDATE);

  try {
    await backendFetch(`/api/v1/applications/admin/${parsed.data.applicationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: parsed.data.status }),
    });
  } catch (error) {
    if (!isBackendUnreachable(error)) {
      return { error: backendMessage(error, "The status could not be updated.") };
    }
    // The API is unreachable: write directly, as this action always could.
    const app = await db.application.findUnique({
      where: { id: parsed.data.applicationId },
      include: { jobProfile: { include: { company: true } } },
    });
    if (!app) return { error: "Application not found." };

    await db.application.update({
      where: { id: parsed.data.applicationId },
      data: { status: parsed.data.status },
    });

    if (notifiesStudent(parsed.data.status)) {
      await db.notification.create({
        data: {
          userId: app.userId,
          title: `Application Update: ${app.jobProfile.title}`,
          message: `Your application for ${app.jobProfile.title} at ${app.jobProfile.company.name} is now: ${parsed.data.status}.`,
          link: "/applications",
        },
      });
    }
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin/dashboard");
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  return { success: `Status updated to ${newStatus}` };
}

export async function bulkUpdateApplicationsAction(
  applicationIds: string[],
  newStatus: ApplicationStatus,
): Promise<AdminApplicationActionState> {
  const parsed = bulkUpdateSchema.safeParse({ applicationIds, status: newStatus });
  if (!parsed.success) return { error: "Select at least one application." };

  await requirePermission(PERM_APPLICATIONS_UPDATE);

  try {
    await backendFetch("/api/v1/applications/admin/bulk-status", {
      method: "POST",
      body: JSON.stringify({ applicationIds: parsed.data.applicationIds, status: parsed.data.status }),
    });
  } catch (error) {
    if (!isBackendUnreachable(error)) {
      return { error: backendMessage(error, "The statuses could not be updated.") };
    }
    // The API is unreachable: write directly, as this action always could.
    const apps = await db.application.findMany({
      where: { id: { in: parsed.data.applicationIds } },
      include: { jobProfile: { include: { company: true } } },
    });

    await db.application.updateMany({
      where: { id: { in: parsed.data.applicationIds } },
      data: { status: parsed.data.status },
    });

    for (const app of notifiesStudent(parsed.data.status) ? apps : []) {
      await db.notification.create({
        data: {
          userId: app.userId,
          title: `Application Update: ${app.jobProfile.title}`,
          message: `Your application for ${app.jobProfile.title} at ${app.jobProfile.company.name} is now: ${parsed.data.status}.`,
          link: "/applications",
        },
      });
    }
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin/dashboard");
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  return { success: `Updated ${applicationIds.length} candidate(s) to ${newStatus}` };
}
