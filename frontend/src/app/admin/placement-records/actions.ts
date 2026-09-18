"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import {
  offerBulkFormSchema,
  offerDeleteSchema,
  offerFormSchema,
  parseRollNumbers,
} from "@/lib/offer-schema";
import {
  PERM_PLACEMENT_RECORDS_CREATE,
  PERM_PLACEMENT_RECORDS_DELETE,
  PERM_PLACEMENT_RECORDS_UPDATE,
} from "@/lib/permissions";

export type OfferActionResult = { error?: string; success?: string };

/** A bulk run reports both halves: what was written and what was not. */
export type OfferBulkActionResult = OfferActionResult & {
  created?: number;
  skipped?: { rollNumber: string; reason: string }[];
};

// Offers exist only in the backend. Unlike the older admin screens there is no
// Prisma fallback here: the dashboard aggregates these rows, and a second
// write path is how the application export drifted from its endpoint.
function revalidateOfferPages() {
  revalidatePath("/admin/placement-records");
  revalidatePath("/admin/dashboard");
  // An offer created from an application (see RecordPlacementDialog) needs
  // that page's "already recorded" state to reflect the new link.
  revalidatePath("/admin/applications");
  // An off-campus/hackathon offer can auto-create a Company row (see
  // resolveCompanyId below); the companies list should pick it up too.
  revalidatePath("/admin/companies");
}

/**
 * An off-campus or hackathon offer routinely names a recruiter the placement
 * cell never opened a drive for — the `Company` table has 7 rows against the
 * ~1,000 names the interview-experience form already offers. Rather than
 * blocking the office at "add the company first", this finds a case-
 * insensitive match on the name or creates a minimal `Company` row for it,
 * the same upsert `saveCompany` in `admin/companies/actions.ts` does for a
 * duplicate name.
 */
async function resolveCompanyId(
  companyId: string | null | undefined,
  companyName: string | null | undefined,
): Promise<string> {
  if (companyId) return companyId;
  const name = (companyName ?? "").trim();
  if (!name) throw new Error("Select or name a company.");

  const existing = await db.company.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.company.create({ data: { name }, select: { id: true } });
  return created.id;
}

function backendMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    // The backend returned plain text rather than a JSON error body.
  }
  return error.message || fallback;
}

export async function saveOfferAction(formData: FormData): Promise<OfferActionResult> {
  await requirePermission(
    formData.get("id") ? PERM_PLACEMENT_RECORDS_UPDATE : PERM_PLACEMENT_RECORDS_CREATE,
  );

  const parsed = offerFormSchema.safeParse({
    id: formData.get("id") ?? undefined,
    userId: formData.get("userId"),
    companyId: formData.get("companyId") ?? "",
    companyName: formData.get("companyName") ?? "",
    jobProfileId: formData.get("jobProfileId") ?? "",
    applicationId: formData.get("applicationId") ?? "",
    type: formData.get("type"),
    status: formData.get("status") || "OFFERED",
    source: formData.get("source") || "ON_CAMPUS",
    jobTitle: formData.get("jobTitle") ?? "",
    batch: formData.get("batch"),
    ctc: formData.get("ctc") ?? "",
    stipend: formData.get("stipend") ?? "",
    location: formData.get("location") ?? "",
    offeredAt: formData.get("offeredAt") ?? "",
    joiningDate: formData.get("joiningDate") ?? "",
    remarks: formData.get("remarks") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the offer details." };
  }

  const { id, ...offer } = parsed.data;
  let companyId: string;
  try {
    companyId = await resolveCompanyId(offer.companyId, offer.companyName);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Select or name a company." };
  }
  const payload = {
    userId: offer.userId,
    companyId,
    jobProfileId: offer.jobProfileId,
    type: offer.type,
    status: offer.status,
    source: offer.source,
    jobTitle: offer.jobTitle,
    batch: offer.batch,
    ctc: offer.ctc,
    stipend: offer.stipend,
    location: offer.location,
    offeredAt: offer.offeredAt?.toISOString() ?? null,
    joiningDate: offer.joiningDate?.toISOString() ?? null,
    remarks: offer.remarks,
  };

  try {
    if (id) {
      // An offer's application link is set once, at creation, and never
      // changed — `OfferUpdate` on the backend has no field for it.
      await backendFetch(`/api/v1/offers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await backendFetch("/api/v1/offers", {
        method: "POST",
        body: JSON.stringify({ ...payload, applicationId: offer.applicationId }),
      });
    }
  } catch (error) {
    return { error: backendMessage(error, "Failed to save the placement record.") };
  }

  revalidateOfferPages();
  return { success: id ? "Placement record updated." : "Placement record added." };
}

export async function saveOfferBulkAction(
  formData: FormData,
): Promise<OfferBulkActionResult> {
  await requirePermission(PERM_PLACEMENT_RECORDS_CREATE);

  const parsed = offerBulkFormSchema.safeParse({
    companyId: formData.get("companyId") ?? "",
    companyName: formData.get("companyName") ?? "",
    jobProfileId: formData.get("jobProfileId") ?? "",
    type: formData.get("type"),
    status: formData.get("status") || "OFFERED",
    source: formData.get("source") || "ON_CAMPUS",
    jobTitle: formData.get("jobTitle") ?? "",
    batch: formData.get("batch"),
    ctc: formData.get("ctc") ?? "",
    stipend: formData.get("stipend") ?? "",
    location: formData.get("location") ?? "",
    remarks: formData.get("remarks") ?? "",
    // The field holds whatever was pasted; the parser is the single definition
    // of how that becomes a list, shared with the client-side chips.
    rollNumbers: parseRollNumbers(String(formData.get("rollNumbers") ?? "")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the record details." };
  }

  const bulk = parsed.data;

  let companyId: string;
  try {
    companyId = await resolveCompanyId(bulk.companyId, bulk.companyName);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Select or name a company." };
  }

  let result: { created: number; skipped?: { rollNumber: string; reason: string }[] };
  try {
    result = await backendFetch<{
      created: number;
      skipped?: { rollNumber: string; reason: string }[];
    }>("/api/v1/offers/bulk", {
      method: "POST",
      body: JSON.stringify({
        companyId,
        jobProfileId: bulk.jobProfileId,
        type: bulk.type,
        status: bulk.status,
        source: bulk.source,
        jobTitle: bulk.jobTitle,
        batch: bulk.batch,
        ctc: bulk.ctc,
        stipend: bulk.stipend,
        location: bulk.location,
        remarks: bulk.remarks,
        rollNumbers: bulk.rollNumbers,
      }),
    });
  } catch (error) {
    return { error: backendMessage(error, "Failed to create the placement records.") };
  }

  revalidateOfferPages();

  const skipped = result.skipped ?? [];
  if (!result.created) {
    return {
      error: "No records were created. Check the roll numbers below.",
      created: 0,
      skipped,
    };
  }

  return {
    success: `Created ${result.created} placement record${result.created === 1 ? "" : "s"}.`,
    created: result.created,
    skipped,
  };
}

export async function deleteOfferAction(formData: FormData): Promise<OfferActionResult> {
  await requirePermission(PERM_PLACEMENT_RECORDS_DELETE);

  const parsed = offerDeleteSchema.safeParse({ offerId: formData.get("offerId") });
  if (!parsed.success) return { error: "Invalid placement record." };

  try {
    await backendFetch(`/api/v1/offers/${parsed.data.offerId}`, { method: "DELETE" });
  } catch (error) {
    return { error: backendMessage(error, "Failed to delete the placement record.") };
  }

  revalidateOfferPages();
  return { success: "Placement record deleted." };
}
