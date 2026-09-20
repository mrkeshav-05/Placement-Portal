import { z } from "zod";
import { sanitizeRichText, stripHtmlToText } from "@/lib/rich-text";

/**
 * The categories the placement cell files a drive under. A closed list, so the
 * event form's buttons and this rule cannot drift. "Core" was deliberately
 * dropped: the cell does not run core-engineering drives.
 */
export const JOB_CATEGORIES = ["Tech", "NonTech", "Management", "Marketing"] as const;

/** Employment types, in the order the event form offers them. */
export const EMPLOYMENT_TYPES = ["INTERNSHIP", "INTERNSHIP_PPO", "INTERNSHIP_FTE", "FTE"] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  INTERNSHIP: "Internship",
  INTERNSHIP_PPO: "Internship+PPO",
  INTERNSHIP_FTE: "Internship+FTE",
  FTE: "FTE",
};

/**
 * What an event may carry — narrower than an announcement's list, mirrored
 * from `EVENT_ATTACHMENT_EXTENSIONS` in the backend's upload router: a job
 * description or a poster, not a spreadsheet.
 */
export const EVENT_ATTACHMENT_EXTENSIONS = ["pdf", "png"] as const;
export const MAX_EVENT_ATTACHMENTS = 5;
export const MAX_EVENT_ATTACHMENT_MB = 4;

export type EventAttachment = {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
};

const eventAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().min(1).max(1000),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative(),
});

/** Posted as a JSON string, the same shape `questions` and `allowedDegrees` are. */
const eventAttachmentsList = z.string().optional().transform((value, context) => {
  const raw = (value ?? "").trim();
  if (!raw) return [];
  let items: unknown;
  try {
    items = JSON.parse(raw);
  } catch {
    context.addIssue({ code: "custom", message: "Could not read the attachments." });
    return z.NEVER;
  }
  const parsed = z
    .array(eventAttachmentSchema)
    .max(MAX_EVENT_ATTACHMENTS, `An event can carry at most ${MAX_EVENT_ATTACHMENTS} files.`)
    .safeParse(items);
  if (!parsed.success) {
    context.addIssue({ code: "custom", message: "Could not read the attachments." });
    return z.NEVER;
  }
  return parsed.data;
});

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.union([z.null(), z.coerce.number().pipe(schema)]),
  );

const requiredNumber = (schema: z.ZodNumber) => z.coerce.number().pipe(schema);

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

const commaSeparated = (label: string, required = false) =>
  z.string().transform((value, context) => {
    const values = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
    if (required && values.length === 0) {
      context.addIssue({ code: "custom", message: `Add at least one ${label}.` });
      return z.NEVER;
    }
    return values;
  });

/**
 * A list the event form posts as JSON, because degrees and branches are picked
 * from checkbox dialogs rather than typed. A comma-separated string still
 * parses, so a hand-built request or an older form keeps working.
 */
const jsonList = (label: string, required = false) =>
  z.string().transform((value, context) => {
    const raw = value.trim();
    let items: unknown;
    if (raw.startsWith("[")) {
      try {
        items = JSON.parse(raw);
      } catch {
        context.addIssue({ code: "custom", message: `Select a valid ${label}.` });
        return z.NEVER;
      }
    } else {
      items = raw.split(",");
    }
    if (!Array.isArray(items)) {
      context.addIssue({ code: "custom", message: `Select a valid ${label}.` });
      return z.NEVER;
    }
    const values = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
    if (required && values.length === 0) {
      context.addIssue({ code: "custom", message: `Select at least one ${label}.` });
      return z.NEVER;
    }
    return values;
  });

/** The types the event form's question builder offers, in menu order. */
export const JOB_QUESTION_TYPES = ["TEXT", "MCQ", "CHECKBOX", "FILE"] as const;

export const JOB_QUESTION_TYPE_LABELS: Record<(typeof JOB_QUESTION_TYPES)[number], string> = {
  TEXT: "Text",
  MCQ: "MCQ (Radio)",
  CHECKBOX: "Checkbox",
  FILE: "File Upload",
};

export type JobQuestion = {
  id: string;
  type: (typeof JOB_QUESTION_TYPES)[number];
  question: string;
  /** Only meaningful for MCQ and Checkbox; empty/omitted otherwise. */
  options?: string[];
};

/**
 * The event form posts this as a JSON string, same as `allowedDegrees` and
 * `allowedBranches`. A question needs its own options only when a student
 * has to pick from a closed list; Text and File Upload carry none.
 */
const jobQuestionsList = z.string().optional().transform((value, context) => {
  const raw = (value ?? "").trim();
  if (!raw) return [];
  let items: unknown;
  try {
    items = JSON.parse(raw);
  } catch {
    context.addIssue({ code: "custom", message: "Could not read the additional questions." });
    return z.NEVER;
  }
  if (!Array.isArray(items)) {
    context.addIssue({ code: "custom", message: "Could not read the additional questions." });
    return z.NEVER;
  }

  const questions: JobQuestion[] = [];
  for (const [index, item] of items.entries()) {
    const parsed = z
      .object({
        id: z.string().min(1),
        type: z.enum(JOB_QUESTION_TYPES),
        question: z.string().trim().min(1),
        options: z.array(z.string().trim().min(1)).optional(),
      })
      .safeParse(item);
    if (!parsed.success) {
      context.addIssue({
        code: "custom",
        message: `Question ${index + 1} needs its text filled in.`,
      });
      return z.NEVER;
    }
    const needsOptions = parsed.data.type === "MCQ" || parsed.data.type === "CHECKBOX";
    const options = needsOptions ? (parsed.data.options ?? []) : undefined;
    if (needsOptions && (!options || options.length < 2)) {
      context.addIssue({
        code: "custom",
        message: `Question ${index + 1} needs at least two options.`,
      });
      return z.NEVER;
    }
    questions.push({ id: parsed.data.id, type: parsed.data.type, question: parsed.data.question, options });
  }
  return questions;
});

export const jobProfileFormSchema = z
  .object({
    id: z.string().optional(),
    companyId: z.string().min(1, "Select a company."),
    title: z.string().trim().min(2, "Enter a role title.").max(160),
    type: z.enum(EMPLOYMENT_TYPES, { message: "Choose an employment type." }),
    locations: commaSeparated("place of posting", true),
    ctcStipend: optionalNumber(z.number().nonnegative().max(100_000_000)),
    ctcStipendInfo: optionalText(500),
    minCGPA: requiredNumber(z.number().min(0).max(10)),
    maxBacklogs: requiredNumber(z.number().int().min(0).max(100)),
    maxBans: requiredNumber(z.number().int().min(0).max(100)),
    allowedBranches: jsonList("branch", true),
    allowedDegrees: jsonList("degree", true),
    allowedGenders: jsonList("gender"),
    questions: jobQuestionsList,
    attachments: eventAttachmentsList,
    jobCategory: z.enum(JOB_CATEGORIES, { message: "Choose a category." }),
    batch: requiredNumber(z.number().int().min(2020).max(2100)),
    placementYear: requiredNumber(z.number().int().min(2020).max(2100)),
    registrationDeadline: z.coerce.date(),
    status: z.enum(["DRAFT", "ACTIVE", "ENDED"]),
    // Stored as sanitized HTML from the rich text editor, the same rule
    // announcement content follows: the length bounds apply to the visible
    // text, not the markup around it.
    description: z
      .string()
      .transform((value) => sanitizeRichText(value))
      .refine((html) => stripHtmlToText(html).length >= 1, "Write a description.")
      .refine((html) => stripHtmlToText(html).length <= 5000, "Description cannot exceed 5,000 characters."),
    openingOverview: optionalText(10_000),
    cap: optionalText(100),
    companyBond: optionalText(200),
    duration: optionalText(100),
    redirectUrl: z
      .union([z.literal(""), z.url({ message: "Enter a full link, including https://" }).max(500)])
      .transform((value) => value || null),
  })
  .superRefine((value, context) => {
    if (value.status === "ACTIVE" && value.registrationDeadline <= new Date()) {
      context.addIssue({
        code: "custom",
        path: ["registrationDeadline"],
        message: "An active job must have a future deadline.",
      });
    }
  });

export const jobProfileDeleteSchema = z.object({ jobProfileId: z.string().min(1) });
