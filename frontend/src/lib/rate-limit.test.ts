import assert from "node:assert/strict";
import test from "node:test";
import { createThrottle } from "./rate-limit";

const MINUTE = 60 * 1000;
const key = "someone@iiitl.ac.in";

test("a key locks only after maxAttempts, and the lock expires after lockoutMs", () => {
  const throttle = createThrottle({ windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 3 });
  throttle.recordAttempt(key, MINUTE);
  throttle.recordAttempt(key, MINUTE);
  assert.equal(throttle.isLockedOut(key, MINUTE), false);

  throttle.recordAttempt(key, MINUTE);
  assert.equal(throttle.isLockedOut(key, MINUTE), true);
  assert.equal(throttle.isLockedOut(key, MINUTE + 14 * MINUTE), true);
  assert.equal(throttle.isLockedOut(key, MINUTE + 16 * MINUTE), false);
});

test("attempts spread beyond the window never accumulate into a lock", () => {
  const throttle = createThrottle({ windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 3 });
  throttle.recordAttempt(key, 0);
  throttle.recordAttempt(key, 0);
  throttle.recordAttempt(key, 16 * MINUTE);
  assert.equal(throttle.isLockedOut(key, 16 * MINUTE), false);
});

test("clearAttempts resets a key's count", () => {
  const throttle = createThrottle({ windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 3 });
  throttle.recordAttempt(key, MINUTE);
  throttle.recordAttempt(key, MINUTE);
  throttle.clearAttempts(key);

  throttle.recordAttempt(key, MINUTE);
  assert.equal(throttle.isLockedOut(key, MINUTE), false);
});

test("keys are throttled independently", () => {
  const throttle = createThrottle({ windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 3 });
  for (let i = 0; i < 3; i += 1) throttle.recordAttempt(key, MINUTE);
  assert.equal(throttle.isLockedOut(key, MINUTE), true);
  assert.equal(throttle.isLockedOut("other@iiitl.ac.in", MINUTE), false);
});

test("separate createThrottle() calls do not share state", () => {
  const a = createThrottle({ windowMs: MINUTE, lockoutMs: MINUTE, maxAttempts: 2 });
  const b = createThrottle({ windowMs: MINUTE, lockoutMs: MINUTE, maxAttempts: 2 });
  a.recordAttempt(key, 0);
  a.recordAttempt(key, 0);
  assert.equal(a.isLockedOut(key, 0), true);
  assert.equal(b.isLockedOut(key, 0), false);
});
