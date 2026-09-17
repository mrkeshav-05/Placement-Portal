import { permanentRedirect } from "next/navigation";

/**
 * Job profiles became Events on 2026-09-17. The old path stays as a redirect
 * because bookmarks and older announcement links still point at it.
 */
export default function Page() {
  permanentRedirect("/admin/events");
}
