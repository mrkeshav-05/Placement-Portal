import { NextRequest, NextResponse } from "next/server";
import { backendAuthHeader, backendBaseUrl } from "@/lib/api-client";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/student-session";
import { requirePermission } from "@/lib/admin-session";
import { PERM_NOC_VIEW } from "@/lib/permissions";

const EXTENSION_MEDIA_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function mediaTypeFor(url: string) {
  const extension = url.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MEDIA_TYPES[extension] ?? "application/octet-stream";
}

// The student's own proof of an off-campus offer — stored via the same
// local/Cloudinary storage as the signed NOC certificate, so this proxies the
// same way frontend/src/app/api/noc-documents/[id]/route.ts does, just
// against `offCampusProofUrl` instead of `documentUrl`.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return new NextResponse("NOC request ID is required", { status: 400 });
  }

  // Authorize: either the owning student, or a staff account that may read
  // NOC requests. Reaching the admin portal at all is NOT sufficient — see
  // the identical comment in noc-documents/[id]/route.ts.
  let isAuthorized = false;
  let currentUserId: string | undefined;

  try {
    await requirePermission(PERM_NOC_VIEW);
    isAuthorized = true;
  } catch {
    try {
      const student = await requireStudent();
      if (student?.user) {
        currentUserId = student.user.id;
      }
    } catch {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const noc = await db.nocRequest.findUnique({ where: { id } });
  if (!noc || !noc.offCampusProofUrl) {
    return new NextResponse("Offer proof document not found", { status: 404 });
  }

  if (!isAuthorized && noc.userId !== currentUserId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const mediaType = mediaTypeFor(noc.offCampusProofUrl);
  const inline = mediaType === "application/pdf" || mediaType.startsWith("image/");

  // External link (Cloudinary or public document)
  if (noc.offCampusProofUrl.startsWith("http://") || noc.offCampusProofUrl.startsWith("https://")) {
    return NextResponse.redirect(noc.offCampusProofUrl);
  }

  // Local storage: stream from the backend, which owns the file on disk.
  try {
    const backendUrl = `${backendBaseUrl()}${noc.offCampusProofUrl}`;
    const res = await fetch(backendUrl, {
      headers: await backendAuthHeader(),
    });

    if (!res.ok) {
      return new NextResponse("Offer proof document could not be retrieved", { status: 502 });
    }

    const data = await res.arrayBuffer();
    const extension = noc.offCampusProofUrl.split(".").pop() ?? "pdf";
    return new NextResponse(data, {
      headers: {
        "Content-Type": mediaType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="offer-proof-${noc.company.replace(/[^a-zA-Z0-9-_]/g, "_")}.${extension}"`,
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("Failed to stream off-campus proof document from backend", error);
    return new NextResponse("Offer proof document could not be retrieved", { status: 502 });
  }
}
