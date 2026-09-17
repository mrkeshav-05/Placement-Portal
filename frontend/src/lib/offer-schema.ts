import { z } from "zod";

export const OFFER_TYPES = ["FTE", "PPO", "INTERNSHIP"] as const;
export const OFFER_STATUSES = ["OFFERED", "ACCEPTED", "DECLINED", "REVOKED"] as const;
export const OFFER_SOURCES = ["ON_CAMPUS", "OFF_CAMPUS", "HACKATHON"] as const;

export type OfferType = (typeof OFFER_TYPES)[number];
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type OfferSource = (typeof OFFER_SOURCES)[number];

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  FTE: "Full-time placement",
  PPO: "Pre-placement offer",
  INTERNSHIP: "Internship",
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  OFFERED: "Offered",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  REVOKED: "Revoked",
};

export const OFFER_SOURCE_LABELS: Record<OfferSource, string> = {
  ON_CAMPUS: "On-Campus",
  OFF_CAMPUS: "Off-Campus",
  // Still an on-campus process for reporting purposes, but distinct enough
  // from a conventional drive that it earns its own value.
  HACKATHON: "Hackathon (On-Campus)",
};

/** FTE and PPO offers carry an annual CTC; internships carry a monthly stipend. */
export function isCtcType(type: string): boolean {
  return type === "FTE" || type === "PPO";
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value ? value : null))
  .nullable()
  .optional();

const optionalAmount = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().nonnegative("Amount cannot be negative.").optional(),
);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

/**
 * A pasted roll-number list, in the shapes a spreadsheet produces: commas,
 * spaces, tabs, newlines, or semicolons between values. Order is kept so the
 * result reads back in the order it was entered, and repeats are dropped
 * because the same student cannot hold the same record twice.
 */
export function parseRollNumbers(input: string): string[] {
  const parsed: string[] = [];
  const seen = new Set<string>();
  for (const token of input.split(/[\s,;]+/)) {
    const roll = token.trim().toUpperCase();
    if (!roll || seen.has(roll)) continue;
    seen.add(roll);
    parsed.push(roll);
  }
  return parsed;
}

const seasonYear = z.coerce
  .number()
  .int()
  .min(2000, "Enter a four-digit season year.")
  .max(2100, "Enter a four-digit season year.");

export const offerFormSchema = z
  .object({
    id: z.string().trim().optional(),
    userId: z.string().trim().min(1, "Select a student."),
    companyId: z.string().trim().min(1, "Select a company."),
    jobProfileId: optionalText,
    /** Links a freshly-created offer back to the application it came from. */
    applicationId: optionalText,
    type: z.enum(OFFER_TYPES),
    status: z.enum(OFFER_STATUSES).default("OFFERED"),
    source: z.enum(OFFER_SOURCES).default("ON_CAMPUS"),
    jobTitle: optionalText,
    batch: seasonYear,
    ctc: optionalAmount,
    stipend: optionalAmount,
    location: optionalText,
    offeredAt: optionalDate,
    joiningDate: optionalDate,
    remarks: optionalText,
  })
  // The amount is required, but which one depends on the offer type, so the
  // rule lives here rather than on either field. The backend repeats it: this
  // check only exists to answer the administrator before the round trip.
  .superRefine((data, ctx) => {
    if (isCtcType(data.type) && data.ctc === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ctc"],
        message: "Enter the annual CTC for a placement or pre-placement offer.",
      });
    }
    if (data.type === "INTERNSHIP" && data.stipend === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stipend"],
        message: "Enter the monthly stipend for an internship offer.",
      });
    }
  })
  // An offer only ever holds the figure that matches its type, so switching a
  // recorded internship to an FTE cannot leave a stale stipend behind.
  .transform((data) => ({
    ...data,
    ctc: isCtcType(data.type) ? data.ctc ?? null : null,
    stipend: data.type === "INTERNSHIP" ? data.stipend ?? null : null,
  }));

/**
 * One configuration applied to a pasted list of roll numbers.
 *
 * The same amount rule as a single record, because the office is recording the
 * same kind of thing in bulk, not a looser kind. The job title is required
 * here and optional on a single record: a bulk entry has no drive title to
 * fall back on when no drive is selected, and it would leave a whole paste of
 * rows with no role at all.
 */
export const offerBulkFormSchema = z
  .object({
    companyId: z.string().trim().min(1, "Select a company."),
    jobProfileId: optionalText,
    type: z.enum(OFFER_TYPES),
    status: z.enum(OFFER_STATUSES).default("OFFERED"),
    source: z.enum(OFFER_SOURCES).default("ON_CAMPUS"),
    jobTitle: z.string().trim().min(1, "Enter the job title.").max(200),
    batch: seasonYear,
    ctc: optionalAmount,
    stipend: optionalAmount,
    location: optionalText,
    remarks: optionalText,
    rollNumbers: z
      .array(z.string().trim().min(1).max(40))
      .min(1, "Add at least one roll number.")
      .max(500, "Add at most 500 roll numbers at a time."),
  })
  .superRefine((data, ctx) => {
    if (isCtcType(data.type) && data.ctc === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ctc"],
        message: "Enter the annual CTC for a placement or pre-placement offer.",
      });
    }
    if (data.type === "INTERNSHIP" && data.stipend === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stipend"],
        message: "Enter the monthly stipend for an internship offer.",
      });
    }
  })
  .transform((data) => ({
    ...data,
    ctc: isCtcType(data.type) ? data.ctc ?? null : null,
    stipend: data.type === "INTERNSHIP" ? data.stipend ?? null : null,
  }));

export const offerDeleteSchema = z.object({
  offerId: z.string().trim().min(1, "Offer ID is required."),
});

export type OfferFormValues = z.infer<typeof offerFormSchema>;
export type OfferBulkFormValues = z.infer<typeof offerBulkFormSchema>;

/**
 * Indian-format currency for the dashboard and the records table. Amounts are
 * whole rupees; lakhs and crores are how the office reads them.
 */
export function formatRupees(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)} LPA`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Stipends are monthly, so they never read as LPA. */
export function formatStipend(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}/month`;
}
