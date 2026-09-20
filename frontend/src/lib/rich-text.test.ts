import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeRichText, stripHtmlToText } from "./rich-text";

test("sanitizeRichText keeps tags the editor's toolbar can produce", () => {
  const html = "<p>Round 2 starts <strong>Monday</strong>. <em>Bring</em> your <u>ID card</u>.</p>";
  assert.equal(sanitizeRichText(html), html);
});

test("sanitizeRichText drops anything outside the allow-list", () => {
  const html =
    '<p onclick="alert(1)">Hello</p><script>alert(1)</script><img src="x" onerror="alert(1)" /><style>body{}</style>';
  const cleaned = sanitizeRichText(html);
  assert.ok(!cleaned.includes("<script"));
  assert.ok(!cleaned.includes("<img"));
  assert.ok(!cleaned.includes("<style"));
  assert.ok(!cleaned.includes("onclick"));
  assert.ok(!cleaned.includes("onerror"));
  assert.ok(cleaned.includes("Hello"));
});

test("sanitizeRichText keeps a link's href but not a javascript: URL", () => {
  const safe = sanitizeRichText('<a href="https://example.com">link</a>');
  assert.ok(safe.includes('href="https://example.com"'));

  const unsafe = sanitizeRichText('<a href="javascript:alert(1)">link</a>');
  assert.ok(!unsafe.includes("javascript:"));
});

test("stripHtmlToText collapses markup and whitespace into plain text", () => {
  assert.equal(
    stripHtmlToText("<p>Round 2 starts on <strong>Monday</strong></p><p>Bring your ID.</p>"),
    "Round 2 starts on Monday Bring your ID.",
  );
});

test("stripHtmlToText treats an empty document the same as an empty string", () => {
  assert.equal(stripHtmlToText("<p></p>"), "");
  assert.equal(stripHtmlToText(""), "");
});
