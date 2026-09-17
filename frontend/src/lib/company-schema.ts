import { z } from "zod";

/**
 * The rounds a company recruits in. A closed list, so the Add Company buttons
 * and this rule cannot drift: a dream-round company may be applied to even
 * after an offer is in hand, which is an eligibility consequence, not a label.
 */
export const COMPANY_CATEGORIES = ["Dream", "First Round"] as const;

export type CompanyCategory = (typeof COMPANY_CATEGORIES)[number];

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

export const companyFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter the company name.").max(120),
  category: z.enum(COMPANY_CATEGORIES, { message: "Choose a company category." }),
  placementSession: z.coerce.number().pipe(z.number().int().min(2020).max(2100)),
  turnover: optionalText(120),
  description: z.string().trim().min(1, "Enter the company information.").max(2000),
});

export const companyDeleteSchema = z.object({ companyId: z.string().min(1) });
