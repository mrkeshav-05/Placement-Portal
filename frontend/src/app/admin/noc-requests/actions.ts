"use server";

import { revalidatePath } from "next/cache";
import { backendAuthHeader, backendBaseUrl, backendFetch } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { PERM_NOC_APPROVE, PERM_NOC_REJECT } from "@/lib/permissions";
import { nocApproveSchema, nocRejectSchema, nocVerifySchema } from "@/lib/noc-schema";

export type NocActionResult = { error?: string; success?: string };

/** The backend's `detail` when it sent one, else the raw message. */
function backendError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  try {
    const detail = JSON.parse(message)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join(", ") || fallback;
  } catch {
    // Not JSON: fall through.
  }
  return message || fallback;
}

export async function approveNocAction(formData: FormData): Promise<NocActionResult> {
  await requirePermission(PERM_NOC_APPROVE);

  const rawNocId = formData.get("nocId");
  const rawRemarks = formData.get("adminRemarks");
  const rawDocUrl = formData.get("documentUrl");

  const parsed = nocApproveSchema.safeParse({
    nocId: rawNocId,
    adminRemarks: rawRemarks || undefined,
    documentUrl: rawDocUrl || undefined,
    stipend: formData.get("stipend"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid approval parameters." };
  }

  const { nocId, adminRemarks, documentUrl, stipend } = parsed.data;

  // No Prisma fallback: approving records the internship offer, which only
  // the backend does (app/services/noc_offers.py). A status flip on its own
  // would approve the NOC without the offer the placement policy reads.
  try {
    await backendFetch(`/api/v1/noc/admin/${nocId}/approve`, {
      method: "POST",
      body: JSON.stringify({
        adminRemarks: adminRemarks ?? undefined,
        documentUrl: documentUrl ?? undefined,
        stipend,
      }),
    });
  } catch (err) {
    console.error("Failed to approve NOC", err);
    return { error: backendError(err, "Failed to approve NOC request.") };
  }

  revalidatePath("/admin/noc-requests");
  revalidatePath("/admin/placement-records");
  revalidatePath("/admin/students");
  revalidatePath("/forms");
  return { success: "NOC request approved successfully." };
}

export async function rejectNocAction(formData: FormData): Promise<NocActionResult> {
  await requirePermission(PERM_NOC_REJECT);

  const rawNocId = formData.get("nocId");
  const rawRemarks = formData.get("adminRemarks");

  const parsed = nocRejectSchema.safeParse({
    nocId: rawNocId,
    adminRemarks: rawRemarks,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please provide a rejection reason." };
  }

  const { nocId, adminRemarks } = parsed.data;

  // No Prisma fallback, for the same reason as approval: rejecting an
  // approved request revokes its internship offer on the backend.
  try {
    await backendFetch(`/api/v1/noc/admin/${nocId}/reject`, {
      method: "POST",
      body: JSON.stringify({ adminRemarks }),
    });
  } catch (err) {
    console.error("Failed to reject NOC", err);
    return { error: backendError(err, "Failed to reject NOC request.") };
  }

  revalidatePath("/admin/noc-requests");
  revalidatePath("/admin/placement-records");
  revalidatePath("/admin/students");
  revalidatePath("/forms");
  return { success: "NOC request rejected." };
}

export async function verifyNocDocumentAction(nocId: string, verified: boolean): Promise<NocActionResult> {
  await requirePermission(PERM_NOC_APPROVE);

  const parsed = nocVerifySchema.safeParse({ nocId, verified });
  if (!parsed.success) {
    return { error: "Invalid verification request." };
  }

  try {
    try {
      await backendFetch(`/api/v1/noc/admin/${parsed.data.nocId}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ verified: parsed.data.verified }),
      });
    } catch {
      // Direct Prisma fallback
      await db.nocRequest.update({
        where: { id: parsed.data.nocId },
        data: { verifiedByPlacementTeam: parsed.data.verified },
      });
    }
  } catch (err) {
    console.error("Failed to update NOC verification", err);
    return { error: err instanceof Error ? err.message : "Failed to update verification status." };
  }

  revalidatePath("/admin/noc-requests");
  return {
    success: parsed.data.verified
      ? "Marked as verified by the placement team."
      : "Verification mark removed.",
  };
}

export async function uploadNocDocumentAction(formData: FormData): Promise<{ error?: string; url?: string }> {
  await requirePermission(PERM_NOC_APPROVE);

  const file = formData.get("file") as File | null;
  const nocId = formData.get("nocId") as string | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "Please select a valid PDF file to upload." };
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files are supported." };
  }

  try {
    const uploadData = new FormData();
    uploadData.append("file", file);

    const endpoint = nocId
      ? `/api/v1/noc/admin/${nocId}/document`
      : `/api/v1/uploads/admin/noc-document`;

    const res = await fetch(`${backendBaseUrl()}${endpoint}`, {
      method: "POST",
      body: uploadData,
      headers: await backendAuthHeader(),
    });

    if (!res.ok) {
      const errText = await res.text();
      let detail = errText;
      try {
        detail = JSON.parse(errText).detail || errText;
      } catch {}
      throw new Error(detail);
    }

    const data = await res.json() as { url: string };

    if (nocId) {
      revalidatePath("/admin/noc-requests");
      revalidatePath("/forms");
    }

    return { url: data.url };
  } catch (err) {
    console.error("Failed to upload NOC document", err);
    return { error: err instanceof Error ? err.message : "Failed to upload document." };
  }
}
