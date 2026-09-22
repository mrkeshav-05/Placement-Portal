/**
 * Brute-force brake for password sign-in, shared across every frontend
 * replica through Redis (see `rate-limit.ts`) — a wrong password from one
 * replica is visible to the next request regardless of which replica
 * answers it. See `backend/app/core/rate_limit.py` for the equivalent
 * throttle guarding the `/admin` table-browser login and the
 * identity-document unlock challenge.
 *
 * `createThrottle`'s own algorithm is what's under test
 * (`rate-limit.test.ts`, against an in-memory fake); this file is just its
 * configuration for this one call site.
 */

import { createThrottle } from "@/lib/rate-limit";

const throttle = createThrottle("login", {
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
  maxAttempts: 8,
});

export const isLockedOut = throttle.isLockedOut;
export const recordFailedAttempt = throttle.recordAttempt;
export const clearFailedAttempts = throttle.clearAttempts;
