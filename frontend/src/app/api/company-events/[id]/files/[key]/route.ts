import { NextRequest, NextResponse } from "next/server";
import { backendAuthHeader, backendBaseUrl } from "@/lib/api-client";
import { requirePermission } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { PERM_JOBS_UPDATE } from "@/lib/permissions";
import { requireStudent } from "@/lib/student-session";

type StoredFile = { fileName: string; fileUrl: string; mimeType: string; sizeBytes: number };

function asFile(value: unknown): StoredFile | null {
  if (!value || typeof value !== "object") return null;
  const file = value as Partial<StoredFile>;
  return typeof file.fileUrl === "string" && typeof file.fileName === "string"
    ? { fileName: file.fileName, fileUrl: file.fileUrl, mimeType: file.mimeType ?? "application/pdf", sizeBytes: file.sizeBytes ?? 0 }
    : null;
}

/**
 * Serves a drive's Job Description (`key = "jd"`) or an extra document
 * (`key = <index>`) to a signed-in student. Local-storage URLs are
 * backend-relative and 404 from a plain link, so the file is proxied here, the
 * same way NOC certificates are. A draft drive is invisible to students.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key } = await params;

  let isStaff = false;
  try {
    await requirePermission(PERM_JOBS_UPDATE);
    isStaff = true;
  } catch {
    try {
      const student = await requireStudent();
      if (!student?.user) return new NextResponse("Unauthorized", { status: 401 });
    } catch {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const job = await db.jobProfile.findUnique({
    where: { id },
    select: { status: true, jdFile: true, attachments: true },
  });
  if (!job || (job.status === "DRAFT" && !isStaff)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let file: StoredFile | null = null;
  if (key === "jd") {
    file = asFile(job.jdFile);
  } else if (/^\d+$/.test(key) && Array.isArray(job.attachments)) {
    file = asFile(job.attachments[Number(key)]);
  }
  if (!file) return new NextResponse("Not found", { status: 404 });

  if (/^https?:\/\//i.test(file.fileUrl)) {
    return NextResponse.redirect(file.fileUrl);
  }
  // Only ever proxy to the backend's own upload route.
  if (!file.fileUrl.startsWith("/api/v1/uploads/files/event_docs/") || file.fileUrl.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const res = await fetch(`${backendBaseUrl()}${file.fileUrl}`, { headers: await backendAuthHeader() });
    if (!res.ok) return new NextResponse("The file could not be retrieved", { status: 502 });
    const safeName = file.fileName.replace(/[^a-zA-Z0-9._ -]/g, "_");
    const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(await res.arrayBuffer(), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${disposition}; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("Failed to stream event file from backend", error);
    return new NextResponse("The file could not be retrieved", { status: 502 });
  }
}
