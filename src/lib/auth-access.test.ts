import assert from "node:assert/strict";
import test from "node:test";
import { canUseGoogleAccount, isAdminEmail } from "./auth-access";

test("institute accounts remain allowed as students", () => {
  assert.equal(canUseGoogleAccount("student@iiitl.ac.in", "external@gmail.com"), true);
  assert.equal(isAdminEmail("student@iiitl.ac.in", "external@gmail.com"), false);
});

test("configured external administrators are allowed and receive admin access", () => {
  assert.equal(canUseGoogleAccount("EXTERNAL@GMAIL.COM", "external@gmail.com"), true);
  assert.equal(isAdminEmail("EXTERNAL@GMAIL.COM", "external@gmail.com"), true);
});

test("unlisted external accounts are rejected", () => {
  assert.equal(canUseGoogleAccount("someone@gmail.com", "external@gmail.com"), false);
});
