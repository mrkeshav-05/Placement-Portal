import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_PASSWORD_LENGTH,
  passwordLoginSchema,
  registrationOtpSchema,
  registrationSchema,
  setPasswordSchema,
} from "./credentials-schema";

test("sign-in normalises the address but never touches the password", () => {
  const parsed = passwordLoginSchema.parse({
    email: "  Student@IIITL.ac.in ",
    password: "  spaces are significant 1  ",
  });
  assert.equal(parsed.email, "student@iiitl.ac.in");
  assert.equal(parsed.password, "  spaces are significant 1  ");
});

test("sign-in applies no strength rule, so old passwords keep working", () => {
  assert.equal(passwordLoginSchema.safeParse({ email: "s@iiitl.ac.in", password: "short" }).success, true);
  assert.equal(passwordLoginSchema.safeParse({ email: "s@iiitl.ac.in", password: "" }).success, false);
  assert.equal(passwordLoginSchema.safeParse({ email: "not-an-email", password: "a" }).success, false);
});

test("registration accepts a confirmed institute-style account", () => {
  const parsed = registrationSchema.parse({
    name: "  Asha Rao  ",
    email: "Asha@iiitl.ac.in",
    password: "correct-horse1",
    confirmPassword: "correct-horse1",
  });
  assert.equal(parsed.name, "Asha Rao");
  assert.equal(parsed.email, "asha@iiitl.ac.in");
});

test("registration reports a mismatch against the confirmation field", () => {
  const result = registrationSchema.safeParse({
    name: "Asha Rao",
    email: "asha@iiitl.ac.in",
    password: "correct-horse1",
    confirmPassword: "correct-horse2",
  });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues[0]?.path, ["confirmPassword"]);
});

test("setting a password holds the same strength rules as registration", () => {
  assert.equal(
    setPasswordSchema.safeParse({ password: "correct-horse1", confirmPassword: "correct-horse1" })
      .success,
    true,
  );
  assert.equal(
    setPasswordSchema.safeParse({ password: "abcdefghijkl", confirmPassword: "abcdefghijkl" })
      .success,
    false,
  );
  // The current password is absent for an account that does not have one yet.
  assert.equal(
    setPasswordSchema.safeParse({
      currentPassword: "old-password1",
      password: "correct-horse1",
      confirmPassword: "correct-horse2",
    }).success,
    false,
  );
});

test("registration rejects passwords that are short or single-class", () => {
  const attempt = (password: string) =>
    registrationSchema.safeParse({
      name: "Asha Rao",
      email: "asha@iiitl.ac.in",
      password,
      confirmPassword: password,
    }).success;

  assert.equal(attempt(`${"a".repeat(MIN_PASSWORD_LENGTH - 2)}1`), false);
  assert.equal(attempt("abcdefghijkl"), false);
  assert.equal(attempt("123456789012"), false);
  assert.equal(attempt(`${"a".repeat(MIN_PASSWORD_LENGTH - 1)}1`), true);
});

test("a registration OTP code must be exactly six digits", () => {
  const parsed = registrationOtpSchema.parse({ email: "Asha@iiitl.ac.in", code: " 123456 " });
  assert.equal(parsed.email, "asha@iiitl.ac.in");
  assert.equal(parsed.code, "123456");

  for (const code of ["12345", "1234567", "12345a", "", "  "]) {
    assert.equal(
      registrationOtpSchema.safeParse({ email: "asha@iiitl.ac.in", code }).success,
      false,
      `expected code=${JSON.stringify(code)} to be rejected`,
    );
  }
});
