"use server";

import { revalidatePath } from "next/cache";
import { backendAuthHeader, backendBaseUrl, backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { invalidateBackendCache } from "@/lib/cache-invalidation";
import { db } from "@/lib/db";
import {
  PERM_ANNOUNCEMENTS_CREATE,
  PERM_ANNOUNCEMENTS_DELETE,
  PERM_ANNOUNCEMENTS_PUBLISH,
  PERM_ANNOUNCEMENTS_UPDATE,
} from "@/lib/permissions";
import {
  announcementDeleteSchema,
  announcementFormSchema,
  announcementStatusSchema,
  ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_MB,
} from "@/lib/announcement-schema";
import type { AnnouncementCategory, AnnouncementStatus } from "@prisma/client";

export type AnnouncementActionResult = { error?: string; success?: string };

/**
 * Clears both caches that hold an announcement.
 *
 * The API drops its own Redis entries when it performs the write, but these
 * actions fall back to Prisma when the API call fails, and that path leaves
 * the cache holding the previous copy. Asking unconditionally costs one
 * request and removes the need to know which path ran.
 */
async function revalidateAnnouncementPages() {
  await invalidateBackendCache("announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
}

export async function saveAnnouncementAction(
  formData: FormData,
): Promise<AnnouncementActionResult> {
  // Composing a new notice and editing an existing one are separate grants,
  // and pushing either one live additionally takes the publish grant.
  const isEdit = Boolean(formData.get("id"));
  const { user } = await requirePermission(
    isEdit ? PERM_ANNOUNCEMENTS_UPDATE : PERM_ANNOUNCEMENTS_CREATE,
  );
  if (formData.get("status") === "PUBLISHED") {
    await requirePermission(PERM_ANNOUNCEMENTS_PUBLISH);
  }

  const rawTags = formData.get("tags");
  let tags: string[] = [];
  if (typeof rawTags === "string" && rawTags.trim()) {
    try {
      const parsedTags = JSON.parse(rawTags);
      tags = Array.isArray(parsedTags) ? parsedTags : rawTags.split(",");
    } catch {
      tags = rawTags.split(",");
    }
  }

  // The edit modal does not carry the attachment list, and an absent field
  // must leave the files alone rather than clear them.
  const attachmentsProvided = formData.has("attachments");

  const parsed = announcementFormSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    content: formData.get("content"),
    category: formData.get("category"),
    status: formData.get("status") || undefined,
    companyId: formData.get("companyId") || undefined,
    jobProfileId: formData.get("jobProfileId") || undefined,
    tags,
    attachments: formData.get("attachments") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check announcement details.",
    };
  }

  const id = parsed.data.id || undefined;

  try {
    try {
      const body = JSON.stringify({
        title: parsed.data.title,
        content: parsed.data.content,
        category: parsed.data.category,
        status: parsed.data.status,
        companyId: parsed.data.companyId,
        jobProfileId: parsed.data.jobProfileId,
        tags: parsed.data.tags,
        ...(attachmentsProvided ? { attachments: parsed.data.attachments } : {}),
      });

      if (id) {
        await backendFetch(`/api/v1/announcements/${id}`, { method: "PATCH", body });
      } else {
        await backendFetch("/api/v1/announcements", { method: "POST", body });
      }
    } catch {
      // Resilient fallback to direct Prisma operations
      const data = {
        title: parsed.data.title,
        content: parsed.data.content,
        category: parsed.data.category as AnnouncementCategory,
        status: parsed.data.status as AnnouncementStatus,
        companyId: parsed.data.companyId ?? null,
        jobProfileId: parsed.data.jobProfileId ?? null,
        tags: parsed.data.tags,
      };

      if (id) {
        // `publishedAt` marks the first time students could see it, so
        // re-publishing a withdrawn announcement keeps the original date.
        const existing = await db.announcement.findUnique({
          where: { id },
          select: { publishedAt: true },
        });
        if (!existing) {
          return { error: "Announcement not found or already deleted." };
        }
        await db.announcement.update({
          where: { id },
          data: {
            ...data,
            publishedAt:
              parsed.data.status === "PUBLISHED" && !existing.publishedAt
                ? new Date()
                : existing.publishedAt,
            // The list arrives whole, so it replaces what is on file.
            ...(attachmentsProvided
              ? { attachments: { deleteMany: {}, create: parsed.data.attachments } }
              : {}),
          },
        });
      } else {
        await db.announcement.create({
          data: {
            ...data,
            publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
            createdById: user.id,
            attachments: { create: parsed.data.attachments },
          },
        });
      }
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to save announcement.",
    };
  }

  await revalidateAnnouncementPages();

  if (parsed.data.status === "DRAFT") {
    return { success: "Draft saved. Students cannot see it yet." };
  }
  return {
    success: id ? "Announcement updated and published." : "Announcement published successfully.",
  };
}

export type AttachmentUploadResult = {
  error?: string;
  attachment?: { fileName: string; fileUrl: string; mimeType: string; sizeBytes: number };
};

/**
 * Store one file for an announcement that may not exist yet.
 *
 * The composer uploads while the author is still writing, so the file lands in
 * storage first and the row that owns it is written when the announcement is
 * saved. The backend re-checks type and size against the file's bytes; the
 * checks here only save a round trip on the obvious rejections.
 */
export async function uploadAnnouncementAttachmentAction(
  formData: FormData,
): Promise<AttachmentUploadResult> {
  await requirePermission(PERM_ANNOUNCEMENTS_CREATE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file was selected." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      error: `"${file.name}" is not an accepted file type. Allowed: ${ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(", ")}.`,
    };
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    return { error: `"${file.name}" exceeds the ${MAX_ATTACHMENT_MB} MB limit.` };
  }

  const body = new FormData();
  body.set("file", file);

  try {
    const response = await fetch(
      `${backendBaseUrl()}/api/v1/uploads/admin/announcement-attachment`,
      { method: "POST", body, headers: await backendAuthHeader() },
    );

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
    // No Prisma fallback: storage lives in the backend, and recording a row
    // that points at a file nobody stored would be worse than failing here.
    return { error: "Attachments need the API, which is unreachable right now." };
  }
}

/** Publish a draft, or withdraw a published announcement back to a draft. */
export async function setAnnouncementStatusAction(
  formData: FormData,
): Promise<AnnouncementActionResult> {
  await requirePermission(PERM_ANNOUNCEMENTS_PUBLISH);

  const parsed = announcementStatusSchema.safeParse({
    announcementId: formData.get("announcementId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "Invalid announcement status change." };
  }

  const { announcementId, status } = parsed.data;

  try {
    try {
      await backendFetch(`/api/v1/announcements/${announcementId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch {
      const existing = await db.announcement.findUnique({
        where: { id: announcementId },
        select: { publishedAt: true },
      });
      if (!existing) return { error: "Announcement not found." };

      await db.announcement.update({
        where: { id: announcementId },
        data: {
          status: status as AnnouncementStatus,
          publishedAt:
            status === "PUBLISHED" && !existing.publishedAt ? new Date() : existing.publishedAt,
        },
      });
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to change the announcement status.",
    };
  }

  await revalidateAnnouncementPages();
  return {
    success:
      status === "PUBLISHED"
        ? "Announcement published. Students can see it now."
        : "Announcement withdrawn to drafts. Students can no longer see it.",
  };
}

export async function deleteAnnouncementAction(
  formData: FormData,
): Promise<AnnouncementActionResult> {
  await requirePermission(PERM_ANNOUNCEMENTS_DELETE);

  const parsed = announcementDeleteSchema.safeParse({
    announcementId: formData.get("announcementId"),
  });

  if (!parsed.success) {
    return { error: "Invalid announcement identifier." };
  }

  try {
    try {
      await backendFetch(`/api/v1/announcements/${parsed.data.announcementId}`, {
        method: "DELETE",
      });
    } catch {
      const deleted = await db.announcement.deleteMany({
        where: { id: parsed.data.announcementId },
      });
      if (!deleted.count) {
        return { error: "Announcement not found." };
      }
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete announcement.",
    };
  }

  await revalidateAnnouncementPages();
  return { success: "Announcement deleted successfully." };
}
