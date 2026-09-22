import { z } from "zod";

/**
 * Closed option lists for the profile dropdowns. The form renders these and the
 * schema validates against them, so the control and the rule cannot drift —
 * adding a value here is the only edit needed to offer it.
 *
 * Mirrored in `backend/app/schemas/student.py`, which is the boundary that
 * actually enforces them; a crafted request never reaches this file.
 */
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const GENDERS = ["Male", "Female"] as const;
/** 0–20, matching the `backlogs Int` column. Stored as a number, never a label. */
export const BACKLOG_OPTIONS = Array.from({ length: 21 }, (_, index) => String(index));

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);
const optionalEmail = z
  .union([z.literal(""), z.string().trim().email()])
  .transform((value) => value || null);

/** An optional choice from a closed list. An empty value clears the field. */
const optionalChoice = (values: readonly [string, ...string[]], label: string) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.enum(values, { message: `Choose a valid ${label}.` }).nullable(),
  );

const optionalNumber = (minimum: number, maximum: number, integer = false) =>
  z.preprocess(
    (value) => value === "" ? null : Number(value),
    (integer ? z.number().int() : z.number()).min(minimum).max(maximum).nullable(),
  );

/**
 * A decimal number with a hard cap on precision.
 *
 * The precision check reads the digits as written rather than doing modular
 * arithmetic on the parsed float: `87.65 % 0.01` is not 0 in binary floating
 * point, so a `multipleOf` check rejects values a human would call valid. The
 * value is only converted to a number once its shape is known to be good.
 */
const optionalDecimal = (minimum: number, maximum: number, maxDecimals: number) =>
  z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? null : String(value).trim(),
    z
      .string()
      .regex(
        new RegExp(`^-?\\d+(\\.\\d{1,${maxDecimals}})?$`),
        `Enter a number with at most ${maxDecimals} decimal places.`,
      )
      .transform(Number)
      .pipe(
        z
          .number()
          .min(minimum, `Must be ${minimum} or more.`)
          .max(maximum, `Must be ${maximum} or less.`),
      )
      .nullable(),
  );

const optionalDate = z.preprocess(
  (value) => value === "" ? null : new Date(String(value)),
  z.date().max(new Date()).nullable(),
);

// Full name, roll number, branch, degree, and graduation year (batch) are set
// by the placement office from the official roster and are deliberately not
// part of this schema: a student cannot write them through this action, no
// matter what a crafted request includes, because the field is never parsed.
//
// cgpa and backlogs are absent for a different reason: both drive job
// eligibility and are shown to recruiters as fact, so a student self-editing
// them would let an ineligible student fabricate eligibility. Only the
// placement office can correct them, through studentAcademicCorrectionSchema
// below, mirrored in `backend/app/schemas/student.py`'s
// `StudentAcademicCorrection`.
export const studentProfileSchema = z.object({
  personalEmail: optionalEmail,
  contactNumber: optionalText(20),
  altContactNumber: optionalText(20),
  gender: optionalChoice(GENDERS, "gender"),
  bloodGroup: optionalChoice(BLOOD_GROUPS, "blood group"),
  dateOfBirth: optionalDate,
  currentAddress: optionalText(500),
  class10Percent: optionalDecimal(0, 100, 2),
  class12Percent: optionalDecimal(0, 100, 2),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;

/** The placement-office-only counterpart to the cgpa/backlogs omitted above. */
export const studentAcademicCorrectionSchema = z.object({
  cgpa: optionalDecimal(0, 10, 2),
  backlogs: optionalNumber(0, 20, true),
});
export type StudentAcademicCorrectionInput = z.infer<typeof studentAcademicCorrectionSchema>;
