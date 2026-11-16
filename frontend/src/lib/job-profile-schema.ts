import { z } from "zod";
import { canonicalBranchList } from "@/lib/branch";
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

/* ------------------------------------------------------------------ */
/* JAF 2026-27 fields                                                  */
/* ------------------------------------------------------------------ */
// Every field is optional and a blank becomes null: null means "not
// provided", never "No", so the student page can show only what the
// placement cell has actually entered.

export const WORK_MODES = ["ON_SITE", "HYBRID", "REMOTE"] as const;
export const WORK_MODE_LABELS: Record<(typeof WORK_MODES)[number], string> = {
  ON_SITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

/**
 * What each employment type asks for, so the admin form, the save action and
 * the student page agree: an FTE has no stipend, duration or PPO, a plain
 * internship has no PPO CTC, compensation breakup or bond. `ctcStipend` is the
 * one headline amount: a monthly stipend for the internship types, a yearly
 * CTC for FTE.
 */
export function employmentFlags(type: string | null | undefined) {
  const internship = type === "INTERNSHIP" || type === "INTERNSHIP_PPO" || type === "INTERNSHIP_FTE";
  const known = Boolean(type);
  return {
    /** `ctcStipend` is a monthly stipend rather than a yearly CTC. */
    stipend: internship,
    duration: internship,
    /** Expected CTC (LPA) of the PPO or of the full-time conversion. */
    expectedCtc: type === "INTERNSHIP_PPO" || type === "INTERNSHIP_FTE",
    /** Fixed / variable / CTC breakup, and the service bond. */
    fullTime: known && type !== "INTERNSHIP",
  };
}

/** Degree categories the JAF asks yearly compensation for. */
export const COMPENSATION_DEGREES = ["B.Tech.", "M.Tech.", "M.Sc.", "MBA", "Ph.D."] as const;

export const SELECTION_ROUND_KEYS = [
  "aptitudeTest",
  "technicalTest",
  "technicalInterview",
  "hrInterview",
] as const;
export const SELECTION_ROUND_LABELS: Record<(typeof SELECTION_ROUND_KEYS)[number], string> = {
  aptitudeTest: "Aptitude test",
  technicalTest: "Technical test",
  technicalInterview: "Technical interview",
  hrInterview: "HR interview",
};

export type CompensationEntry = { fixed?: number; variable?: number; ctc?: number };
export type SelectionRound = {
  conducted?: boolean;
  duration?: string;
  rounds?: number;
  sequence?: string;
};

const nullableNumber = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.union([z.null(), z.coerce.number().nonnegative().max(max)]),
  );

const nullableText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((value) => (value ?? "").trim())
    .pipe(z.string().max(max))
    .transform((value) => value || null);

const nullableBoolean = z.boolean().nullish().transform((value) => value ?? null);

const compensationSchema = z
  .record(
    z.string(),
    z.object({
      fixed: nullableNumber(10_000_000_000),
      variable: nullableNumber(10_000_000_000),
      ctc: nullableNumber(10_000_000_000),
    }),
  )
  .nullish()
  .transform((value) => {
    const cleaned: Record<string, CompensationEntry> = {};
    for (const degree of COMPENSATION_DEGREES) {
      const entry = value?.[degree];
      if (!entry) continue;
      const out: CompensationEntry = {};
      if (entry.fixed !== null) out.fixed = entry.fixed;
      if (entry.variable !== null) out.variable = entry.variable;
      if (entry.ctc !== null) out.ctc = entry.ctc;
      if (Object.keys(out).length) cleaned[degree] = out;
    }
    return Object.keys(cleaned).length ? cleaned : null;
  });

const selectionRoundsSchema = z
  .record(
    z.string(),
    z.object({
      conducted: nullableBoolean,
      duration: nullableText(100),
      rounds: nullableNumber(50),
      sequence: nullableText(200),
    }),
  )
  .nullish()
  .transform((value) => {
    const cleaned: Record<string, SelectionRound> = {};
    for (const key of SELECTION_ROUND_KEYS) {
      const entry = value?.[key];
      if (!entry) continue;
      const out: SelectionRound = {};
      if (entry.conducted !== null) out.conducted = entry.conducted;
      if (entry.duration) out.duration = entry.duration;
      if (entry.rounds !== null) out.rounds = Math.trunc(entry.rounds);
      if (entry.sequence) out.sequence = entry.sequence;
      if (Object.keys(out).length) cleaned[key] = out;
    }
    return Object.keys(cleaned).length ? cleaned : null;
  });

export const jafDetailsSchema = z.object({
  workMode: z.enum(WORK_MODES).nullish().transform((value) => value ?? null),
  joiningDate: nullableText(100),
  ppoCtcLpa: nullableNumber(1000),
  compensation: compensationSchema,
  hasBond: nullableBoolean,
  ppt: nullableBoolean,
  resumeShortlisting: nullableBoolean,
  shortlistCriteria: nullableText(1000),
  selectionRounds: selectionRoundsSchema,
  selectionNotes: nullableText(3000),
  jdFile: eventAttachmentSchema.nullish().transform((value) => value ?? null),
});

export type JafDetails = z.infer<typeof jafDetailsSchema>;

/** The form posts these as one JSON string; blank or missing means none. */
const jafDetailsField = z.string().optional().transform((value, context) => {
  const raw = (value ?? "").trim();
  if (!raw) return jafDetailsSchema.parse({});
  let items: unknown;
  try {
    items = JSON.parse(raw);
  } catch {
    context.addIssue({ code: "custom", message: "Could not read the additional details." });
    return z.NEVER;
  }
  const parsed = jafDetailsSchema.safeParse(items);
  if (!parsed.success) {
    context.addIssue({
      code: "custom",
      message: parsed.error.issues[0]?.message ?? "Check the additional details.",
    });
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

/**
 * `jsonList` for branch codes: a legacy alias is folded onto its canonical
 * code and the duplicate that leaves is dropped, so an event can never be
 * saved open to "CSE" as a branch separate from "CS".
 */
const branchList = (required = false) =>
  jsonList("branch", required).transform((values) => canonicalBranchList(values));

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
    min10Percent: optionalNumber(z.number().min(0).max(100)),
    min12Percent: optionalNumber(z.number().min(0).max(100)),
    maxBacklogs: requiredNumber(z.number().int().min(0).max(100)),
    maxBans: requiredNumber(z.number().int().min(0).max(100)),
    allowedBranches: branchList(true),
    allowedDegrees: jsonList("degree", true),
    allowedGenders: jsonList("gender"),
    questions: jobQuestionsList,
    attachments: eventAttachmentsList,
    jaf: jafDetailsField,
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
