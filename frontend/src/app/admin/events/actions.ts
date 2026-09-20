"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { backendAuthHeader, backendBaseUrl } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import {
  EVENT_ATTACHMENT_EXTENSIONS,
  MAX_EVENT_ATTACHMENT_MB,
  jobProfileDeleteSchema,
  jobProfileFormSchema,
} from "@/lib/job-profile-schema";
import {
  PERM_JOBS_CREATE,
  PERM_JOBS_DELETE,
  PERM_JOBS_PUBLISH,
  PERM_JOBS_UPDATE,
} from "@/lib/permissions";
import { invalidateBackendCache } from "@/lib/cache-invalidation";

export type JobProfileActionResult = { error?: string; success?: string };

export type EventAttachmentUploadResult = {
  error?: string;
  attachment?: { fileName: string; fileUrl: string; mimeType: string; sizeBytes: number };
};

/**
 * Stores one file for an event that may not exist yet, the same
 * stage-before-save flow the announcement composer uses: the file lands in
 * storage first, and the row that owns it is written when the event is saved.
 */
export async function uploadEventAttachmentAction(
  formData: FormData,
): Promise<EventAttachmentUploadResult> {
  await requirePermission(PERM_JOBS_CREATE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file was selected." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(EVENT_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      error: `"${file.name}" is not an accepted file type. Allowed: ${EVENT_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`,
    };
  }
  if (file.size > MAX_EVENT_ATTACHMENT_MB * 1024 * 1024) {
    return { error: `"${file.name}" exceeds the ${MAX_EVENT_ATTACHMENT_MB} MB limit.` };
  }

  const body = new FormData();
  body.set("file", file);

  try {
    const response = await fetch(`${backendBaseUrl()}/api/v1/uploads/admin/event-attachment`, {
      method: "POST",
      body,
      headers: await backendAuthHeader(),
    });

    const text = await response.text();
    if (!response.ok) {
      try {
        return { error: JSON.parse(text).detail ?? "The upload failed." };
      } catch {
        return { error: "The upload failed." };
      }
    }

    const result = JSON.parse(text);
    return {
      attachment: {
        fileName: result.fileName,
        fileUrl: result.url,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      },
    };
  } catch {
    return { error: "Attachments need the API, which is unreachable right now." };
  }
}

async function revalidateEventPages() {
  // Two caches, and both have to let go. Next's route cache holds the
  // rendered pages; Redis, behind the API, holds the rows they render from.
  // Clearing only the first would rebuild the page from the stale list.
  await invalidateBackendCache("events");
  revalidatePath("/admin/events");
  revalidatePath("/admin/dashboard");
  revalidatePath("/company-events");
  revalidatePath("/dashboard");
}

export async function saveJobProfile(formData: FormData): Promise<JobProfileActionResult> {
  const isEdit = Boolean(formData.get("id"));
  const { user } = await requirePermission(isEdit ? PERM_JOBS_UPDATE : PERM_JOBS_CREATE);
  // Making a drive visible to students is its own grant, as it is for
  // announcements: drafting an event is not publishing one.
  if (formData.get("status") === "ACTIVE") {
    await requirePermission(PERM_JOBS_PUBLISH);
  }

  const parsed = jobProfileFormSchema.safeParse({
    id: formData.get("id") ?? "",
    companyId: formData.get("companyId"),
    title: formData.get("title"),
    type: formData.get("type"),
    locations: formData.get("locations"),
    ctcStipend: formData.get("ctcStipend"),
    ctcStipendInfo: formData.get("ctcStipendInfo"),
    minCGPA: formData.get("minCGPA"),
    maxBacklogs: formData.get("maxBacklogs"),
    maxBans: formData.get("maxBans"),
    allowedBranches: formData.get("allowedBranches"),
    allowedDegrees: formData.get("allowedDegrees"),
    allowedGenders: formData.get("allowedGenders"),
    questions: formData.get("questions") ?? "[]",
    attachments: formData.get("attachments") ?? "[]",
    jobCategory: formData.get("jobCategory"),
    batch: formData.get("batch"),
    placementYear: formData.get("placementYear"),
    registrationDeadline: formData.get("registrationDeadline"),
    status: formData.get("status"),
    description: formData.get("description"),
    openingOverview: formData.get("openingOverview"),
    cap: formData.get("cap"),
    companyBond: formData.get("companyBond"),
    duration: formData.get("duration"),
    redirectUrl: formData.get("redirectUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the event details." };
  }

  const id = parsed.data.id || undefined;
  const company = await db.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true },
  });
  if (!company) return { error: "The selected company no longer exists." };

  const data = {
    companyId: parsed.data.companyId,
    title: parsed.data.title,
    type: parsed.data.type,
    locations: parsed.data.locations,
    ctcStipend: parsed.data.ctcStipend,
    ctcStipendInfo: parsed.data.ctcStipendInfo,
    minCGPA: parsed.data.minCGPA,
    maxBacklogs: parsed.data.maxBacklogs,
    maxBans: parsed.data.maxBans,
    allowedBranches: parsed.data.allowedBranches,
    allowedDegrees: parsed.data.allowedDegrees,
    allowedGenders: parsed.data.allowedGenders,
    // A plain `null` is ambiguous for a `Json?` column — Prisma needs the
    // explicit `Prisma.JsonNull` sentinel to write SQL NULL rather than the
    // JSON literal `null`.
    questions: parsed.data.questions.length
      ? (parsed.data.questions as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    attachments: parsed.data.attachments.length
      ? (parsed.data.attachments as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    jobCategory: parsed.data.jobCategory,
    batch: parsed.data.batch,
    placementYear: parsed.data.placementYear,
    registrationDeadline: parsed.data.registrationDeadline,
    status: parsed.data.status,
    description: parsed.data.description,
    openingOverview: parsed.data.openingOverview,
    cap: parsed.data.cap,
    companyBond: parsed.data.companyBond,
    duration: parsed.data.duration,
    redirectUrl: parsed.data.redirectUrl,
  };

  if (id) {
    const updated = await db.jobProfile.updateMany({ where: { id }, data });
    if (!updated.count) return { error: "Event not found." };
  } else {
    await db.jobProfile.create({ data: { ...data, createdById: user.id } });
  }

  await revalidateEventPages();
  return { success: id ? "Event updated." : "Event created." };
}

export async function deleteJobProfile(formData: FormData): Promise<JobProfileActionResult> {
  await requirePermission(PERM_JOBS_DELETE);
  const parsed = jobProfileDeleteSchema.safeParse({ jobProfileId: formData.get("jobProfileId") });
  if (!parsed.success) return { error: "Invalid event." };

  const applicationCount = await db.application.count({
    where: { jobProfileId: parsed.data.jobProfileId },
  });
  if (applicationCount > 0) {
    return { error: "This event has applications. Set it to Ended instead of deleting it." };
  }

  const deleted = await db.jobProfile.deleteMany({ where: { id: parsed.data.jobProfileId } });
  if (!deleted.count) return { error: "Event not found." };
  await revalidateEventPages();
  return { success: "Event deleted." };
}
