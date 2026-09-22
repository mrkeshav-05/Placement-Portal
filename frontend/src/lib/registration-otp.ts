import "server-only";

import { createHash, randomInt } from "node:crypto";
import { SignJWT } from "jose";
import { backendBaseUrl } from "@/lib/api-client";
import { requireAuthSecret } from "@/lib/auth";
import { db } from "@/lib/db";
import { createThrottle } from "@/lib/rate-limit";

/**
 * Email-OTP verification for registration.
 *
 * See docs/DECISIONS.md (2026-09-22): before this, `/register` let anyone
 * "claim" a pre-seeded student row, or create a new one, by submitting an
 * institute email plus a password — no proof the caller controlled that
 * mailbox. A guessable roll-number-style address was enough to take over a
 * classmate's account. This module is what closes that gap: nothing writes
 * to `User` until a 6-digit code sent to the address has been typed back.
 *
 * The code and the caller's staged `{ name, passwordHash }` live in the
 * dormant `VerificationToken` table (Auth.js-scaffolded, never written since
 * Google sign-in was removed — see the 2026-09-17 entries) rather than a new
 * table, and only `consumeRegistrationOtp` ever reads that payload back, at
 * the moment it is applied to `User`.
 */

const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;

const OTP_REQUEST_PURPOSE = "register-otp-email";

// A wrong guess and a fresh request are different kinds of abuse — one is
// pointed at Resend's bill and a victim's inbox, the other at the 6-digit
// space itself — so they get separate limits. Same "resets on deploy,
// single-replica only" caveat as `login-throttle.ts`.
const requestThrottle = createThrottle({ windowMs: 15 * 60 * 1000, lockoutMs: 15 * 60 * 1000, maxAttempts: 4 });
const verifyThrottle = createThrottle({ windowMs: 15 * 60 * 1000, lockoutMs: 15 * 60 * 1000, maxAttempts: 6 });

export function isOtpRequestLockedOut(email: string) {
  return requestThrottle.isLockedOut(email);
}

export function isOtpVerifyLockedOut(email: string) {
  return verifyThrottle.isLockedOut(email);
}

function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export type PendingRegistration = { name: string; passwordHash: string };

/**
 * Stages a fresh code for `email`, replacing any code already pending for
 * it — a resend invalidates whatever was sent before, so only the code just
 * emailed can ever be the one that's typed back.
 */
async function issueRegistrationOtp(email: string, pending: PendingRegistration): Promise<string> {
  const code = generateOtpCode();
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.verificationToken.deleteMany({ where: { identifier: email } });
  await db.verificationToken.create({
    data: { identifier: email, token: hashOtp(code), expires, payload: pending },
  });

  return code;
}

/**
 * Mints a two-minute, purpose-scoped token carrying the code and asks the
 * backend to email it — the backend never sees or trusts anything else,
 * and never generates or stores the code itself; the frontend already owns
 * the token it just wrote.
 */
async function requestOtpEmailDelivery(email: string, code: string): Promise<void> {
  const token = await new SignJWT({ purpose: OTP_REQUEST_PURPOSE, email, code })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(requireAuthSecret()));

  const res = await fetch(`${backendBaseUrl()}/api/v1/auth/internal/send-registration-otp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`OTP email dispatch failed: ${res.status}`);
  }
}

/**
 * Requests a registration OTP: rate-limits, stages the code, and asks the
 * backend to send it. Throws only on the throttle; a delivery failure is
 * reported back to the caller to relay as a form error.
 */
export async function requestRegistrationOtp(
  email: string,
  pending: PendingRegistration,
): Promise<{ sent: true } | { sent: false; error: string }> {
  if (isOtpRequestLockedOut(email)) {
    return { sent: false, error: "Too many codes requested. Try again in a few minutes." };
  }
  requestThrottle.recordAttempt(email);

  const code = await issueRegistrationOtp(email, pending);
  try {
    await requestOtpEmailDelivery(email, code);
  } catch (error) {
    console.error("Failed to send registration OTP email", error);
    return { sent: false, error: "Could not send the verification email. Please try again." };
  }
  return { sent: true };
}

/**
 * Verifies a submitted code and, if correct, returns the staged
 * `{ name, passwordHash }` for the caller to apply to `User` — one-time use,
 * the matching `VerificationToken` row is deleted either way so a code
 * cannot be replayed after a successful claim.
 */
export async function consumeRegistrationOtp(
  email: string,
  code: string,
): Promise<{ ok: true; pending: PendingRegistration } | { ok: false; error: string }> {
  if (isOtpVerifyLockedOut(email)) {
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  const record = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: hashOtp(code) } },
  });

  if (!record || record.expires < new Date()) {
    verifyThrottle.recordAttempt(email);
    return { ok: false, error: "That code is incorrect or has expired." };
  }

  await db.verificationToken.delete({
    where: { identifier_token: { identifier: email, token: record.token } },
  });

  const pending = record.payload as unknown as PendingRegistration | null;
  if (!pending?.passwordHash) {
    return { ok: false, error: "That code is incorrect or has expired." };
  }

  verifyThrottle.clearAttempts(email);
  return { ok: true, pending };
}
