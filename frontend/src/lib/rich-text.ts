import DOMPurify from "isomorphic-dompurify";

/**
 * Tags the announcement rich text editor's toolbar can actually produce.
 * Kept as a closed allow-list — rather than trusting whatever Tiptap
 * happens to emit — so a request built by hand (bypassing the editor
 * entirely) can't smuggle in anything beyond what an admin using the UI
 * could have written.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
];
const ALLOWED_ATTR = ["href", "target", "rel"];

/**
 * Sanitizes announcement HTML before it is stored or rendered.
 *
 * Called from both the Zod schema (so a hand-built request never reaches
 * the database with anything unexpected in it) and every render site (so a
 * row written before this allow-list existed, or by a caller that skipped
 * the schema, still comes out safe).
 */
export function sanitizeAnnouncementHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  }).trim();
}

/**
 * Strips markup down to plain text, collapsing the whitespace tags leave
 * behind. Used wherever the announcement's body needs to act like a plain
 * string again — search indexing, one-line table previews, and the
 * "did they actually type anything" check the submit buttons use, since an
 * empty rich-text document still serializes to `<p></p>`, never `""`.
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
