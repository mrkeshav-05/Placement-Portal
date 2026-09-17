"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin-session";
import { companyDeleteSchema, companyFormSchema } from "@/lib/company-schema";
import {
  PERM_COMPANIES_CREATE,
  PERM_COMPANIES_DELETE,
  PERM_COMPANIES_UPDATE,
} from "@/lib/permissions";

export type CompanyActionResult = { error?: string; success?: string };

export async function saveCompany(formData: FormData): Promise<CompanyActionResult> {
  const id = String(formData.get("id") ?? "") || undefined;
  // Creating a recruiter and correcting one are separate grants, so the check
  // has to know which is happening before it runs.
  await requirePermission(id ? PERM_COMPANIES_UPDATE : PERM_COMPANIES_CREATE);

  const parsed = companyFormSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    category: formData.get("category"),
    placementSession: formData.get("placementSession"),
    turnover: formData.get("turnover"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the company details." };
  }

  const duplicate = await db.company.findFirst({
    where: {
      name: { equals: parsed.data.name, mode: "insensitive" },
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return { error: "A company with this name already exists." };

  // The website and logo are deliberately absent: the form no longer collects
  // them, and writing them here would erase whatever a company already has.
  const data = {
    name: parsed.data.name,
    category: parsed.data.category,
    placementSession: parsed.data.placementSession,
    turnover: parsed.data.turnover,
    description: parsed.data.description,
  };

  if (id) {
    const updated = await db.company.updateMany({ where: { id }, data });
    if (!updated.count) return { error: "Company not found." };
  } else {
    await db.company.create({ data });
  }

  revalidatePath("/admin/companies");
  revalidatePath("/admin/dashboard");
  revalidatePath("/company-events");
  return { success: id ? "Company updated." : "Company created." };
}

export async function deleteCompany(formData: FormData): Promise<CompanyActionResult> {
  await requirePermission(PERM_COMPANIES_DELETE);
  const parsed = companyDeleteSchema.safeParse({ companyId: formData.get("companyId") });
  if (!parsed.success) return { error: "Invalid company." };

  const jobCount = await db.jobProfile.count({ where: { companyId: parsed.data.companyId } });
  if (jobCount > 0) {
    return { error: "Delete or reassign this company’s events first." };
  }

  const deleted = await db.company.deleteMany({ where: { id: parsed.data.companyId } });
  if (!deleted.count) return { error: "Company not found." };

  revalidatePath("/admin/companies");
  revalidatePath("/admin/dashboard");
  return { success: "Company deleted." };
}
