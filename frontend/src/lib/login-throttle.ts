/**
 * Best-effort brute-force brake for password sign-in.
 *
 * The counter lives in the process, so it resets on deploy and is not shared
 * between replicas. That is enough to make online guessing impractical at the
 * current single-container deployment; move the counter to Postgres or Redis
 * before running the frontend at more than one replica.
 */

import { createThrottle } from "@/lib/rate-limit";

const throttle = createThrottle({
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
  maxAttempts: 8,
});

export const isLockedOut = throttle.isLockedOut;
export const recordFailedAttempt = throttle.recordAttempt;
export const clearFailedAttempts = throttle.clearAttempts;
export const resetLoginThrottle = throttle.reset;
