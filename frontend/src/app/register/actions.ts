"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { canSelfRegister, isAdminEmail } from "@/lib/auth-access";
import { registrationOtpSchema, registrationSchema } from "@/lib/credentials-schema";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { consumeRegistrationOtp, requestRegistrationOtp } from "@/lib/registration-otp";

export type FormProblem = { title: string; body: string };

type RegisterErrorCode = "Domain" | "Staff" | "Exists";

function describeRegistrabilityError(code: RegisterErrorCode): FormProblem {
  if (code === "Exists") {
    return {
      title: "This address already has an account",
      body: "Sign in instead. If you have lost the password, ask the placement office to set a new one.",
    };
  }
  if (code === "Domain") {
    return {
      title: "Use your institute address",
      body: "Password accounts are limited to institute addresses.",
    };
  }
  return {
    title: "Placement office accounts are created by the office",
    body: "Ask the placement cell to create your account and give you its first password. You can change it afterwards.",
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

type Registrability =
  | { ok: true; mode: "claim"; userId: string }
  | { ok: true; mode: "create" }
  | { ok: false; error: RegisterErrorCode };

/**
 * Whether `email` may register right now, and how. Shared by the OTP-request
 * step (fail fast, before ever sending a code) and the OTP-verify step
 * (re-checked, because minutes pass between the two and the row this would
 * claim could have changed — an administrator could have set it a password
 * in the meantime, or a second request for the same address could be racing
 * this one to the verify step).
 */
async function checkRegistrability(email: string): Promise<Registrability> {
  if (!canSelfRegister(email)) return { ok: false, error: "Domain" };

  // An allowlisted administrator address is provisioned, never self-served:
  // registering one would hand out the ADMIN role that ADMIN_EMAILS grants.
  if (isAdminEmail(email)) return { ok: false, error: "Staff" };

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, passwordHash: true },
  });

  if (existing) {
    // A row with no password is someone who used to sign in with Google, or
    // an account an administrator pre-provisioned. Students may claim theirs
    // here so they keep their profile, applications, and resumes — once the
    // OTP step below proves they hold the mailbox. Anything privileged is
    // provisioned instead, because claiming it would take over whatever it
    // carries.
    if (existing.passwordHash) return { ok: false, error: "Exists" };
    if (existing.role !== "STUDENT") return { ok: false, error: "Staff" };

    const teamMember = await db.teamMember.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (teamMember) return { ok: false, error: "Staff" };

    return { ok: true, mode: "claim", userId: existing.id };
  }

  // A placement team member listed in the directory but without an account
  // is staff-to-be: their permissions come from /admin/users, so they must
  // not arrive as a self-registered student.
  const teamMember = await db.teamMember.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (teamMember) return { ok: false, error: "Staff" };

  return { ok: true, mode: "create" };
}

export type RegistrationOtpRequestResult =
  | { success: true; email: string }
  | { success: false; error: FormProblem; fieldErrors?: Record<string, string[]> };

/**
 * Step 1: validate, check whether the address may register at all, then
 * stage a password hash and email a 6-digit code. Nothing is written to
 * `User` yet — see docs/DECISIONS.md (2026-09-22).
 */
export async function requestRegistrationOtpAction(formData: FormData): Promise<RegistrationOtpRequestResult> {
  const parsed = registrationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: { title: "Check the highlighted fields", body: "Fix the fields marked below and try again." },
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { name, email, password } = parsed.data;

  const check = await checkRegistrability(email);
  if (!check.ok) {
    return { success: false, error: describeRegistrabilityError(check.error) };
  }

  const result = await requestRegistrationOtp(email, { name, passwordHash: await hashPassword(password) });
  if (!result.sent) {
    return { success: false, error: { title: "Could not send the code", body: result.error } };
  }

  return { success: true, email };
}

export type RegistrationOtpVerifyResult = { error: FormProblem } | undefined;

/**
 * Step 2: verify the code and, only now, write to `User` — claiming a
 * pre-seeded row or creating a new one, whichever `checkRegistrability`
 * still allows at this moment. `password` travels with this step only to
 * complete the same `signIn` call the old single-step action made; it is
 * never used to decide whether the OTP was correct.
 */
export async function verifyRegistrationOtpAction(formData: FormData): Promise<RegistrationOtpVerifyResult> {
  const parsed = registrationOtpSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: { title: "Enter the 6-digit code", body: "Check the code from your email and try again." } };
  }
  const { email, code } = parsed.data;
  const password = formData.get("password");
  if (typeof password !== "string" || !password) {
    return { error: { title: "Session expired", body: "Go back and fill in the form again." } };
  }

  const outcome = await consumeRegistrationOtp(email, code);
  if (!outcome.ok) {
    return { error: { title: "That code didn't work", body: outcome.error } };
  }

  const check = await checkRegistrability(email);
  if (!check.ok) {
    return { error: describeRegistrabilityError(check.error) };
  }

  const { name, passwordHash } = outcome.pending;

  if (check.mode === "claim") {
    await db.user.update({
      where: { id: check.userId },
      data: { name, passwordHash, emailVerified: new Date() },
    });
  } else {
    try {
      await db.user.create({
        data: { name, email, passwordHash, role: "STUDENT", emailVerified: new Date() },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { error: describeRegistrabilityError("Exists") };
      }
      throw error;
    }
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=CredentialsSignin");
    throw error;
  }
}
