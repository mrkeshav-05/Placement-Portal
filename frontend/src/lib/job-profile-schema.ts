import { z } from "zod";

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
    jobCategory: z.enum(JOB_CATEGORIES, { message: "Choose a category." }),
    batch: requiredNumber(z.number().int().min(2020).max(2100)),
    placementYear: requiredNumber(z.number().int().min(2020).max(2100)),
    registrationDeadline: z.coerce.date(),
    status: z.enum(["DRAFT", "ACTIVE", "ENDED"]),
    description: z.string().trim().min(1, "Write a description.").max(5000),
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
