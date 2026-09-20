import { z } from "zod";
import { sanitizeAnnouncementHtml, stripHtmlToText } from "@/lib/rich-text";

const tagsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON, continue to comma split
    }
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string().trim().min(1)).transform((arr) => [...new Set(arr)]));

/** What an announcement may carry, mirrored from the backend's closed list. */
export const ATTACHMENT_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "csv",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
] as const;

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_MB = 10;

/** One file already stored by the upload endpoint, waiting to be attached. */
export const announcementAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().min(1).max(1000),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative(),
});

const attachmentsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}, z.array(announcementAttachmentSchema).max(MAX_ATTACHMENTS, `An announcement can carry at most ${MAX_ATTACHMENTS} files.`));

export const ANNOUNCEMENT_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const announcementFormSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Title must be at least 2 characters.").max(200, "Title cannot exceed 200 characters."),
    // Stored as sanitized HTML from the rich text editor. The length limits
    // apply to the visible text, not the markup around it — a heavily
    // formatted announcement carries more bytes than characters, and a bare
    // byte cap would reject it for formatting that has nothing to do with
    // "too long".
    content: z
      .string()
      .transform((value) => sanitizeAnnouncementHtml(value))
      .refine(
        (html) => stripHtmlToText(html).length >= 2,
        "Content must be at least 2 characters.",
      )
      .refine(
        (html) => stripHtmlToText(html).length <= 10000,
        "Content cannot exceed 10,000 characters.",
      ),
    category: z.enum(["COMPANY_EVENT", "GENERAL"]),
    // Publishing is the default so an omitted status can never silently hide
    // an announcement the cell meant to send.
    status: z.enum(ANNOUNCEMENT_STATUSES).default("PUBLISHED"),
    companyId: z
      .string()
      .trim()
      .transform((value) => (value ? value : null))
      .nullable()
      .optional(),
    // The drive the announcement is about. Only a company event has one.
    jobProfileId: z
      .string()
      .trim()
      .transform((value) => (value ? value : null))
      .nullable()
      .optional(),
    tags: tagsSchema,
    attachments: attachmentsSchema,
  })
  .transform((data) => ({
    ...data,
    companyId: data.category === "GENERAL" ? null : data.companyId,
    jobProfileId: data.category === "GENERAL" ? null : data.jobProfileId ?? null,
  }));

export const announcementDeleteSchema = z.object({
  announcementId: z.string().min(1, "Announcement ID is required."),
});

/** Publishing a draft, or withdrawing a published announcement to a draft. */
export const announcementStatusSchema = z.object({
  announcementId: z.string().min(1, "Announcement ID is required."),
  status: z.enum(ANNOUNCEMENT_STATUSES),
});

export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;
