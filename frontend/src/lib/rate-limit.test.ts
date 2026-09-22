import assert from "node:assert/strict";
import test from "node:test";
import { createThrottle, type RedisLike } from "./rate-limit";

const MINUTE = 60 * 1000;

/**
 * Enough of ioredis for the throttle's own calls: a counter with an NX
 * expiry, a lock key, and a delete. `advance()` moves a fake clock so tests
 * can assert on window/lockout expiry without real timers.
 */
function createFakeRedis(): RedisLike & { advance(ms: number): void } {
  const counts = new Map<string, { value: number; expiresAt: number | null }>();
  const locks = new Map<string, number>(); // value -> expiresAt
  let now = 0;

  function liveCount(key: string) {
    const entry = counts.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      counts.delete(key);
      return null;
    }
    return entry;
  }

  function isLocked(key: string) {
    const expiresAt = locks.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= now) {
      locks.delete(key);
      return false;
    }
    return true;
  }

  return {
    async incr(key) {
      const entry = liveCount(key) ?? { value: 0, expiresAt: null };
      entry.value += 1;
      counts.set(key, entry);
      return entry.value;
    },
    async pexpire(key, milliseconds, mode) {
      const entry = counts.get(key);
      if (!entry) return 0;
      if (mode === "NX" && entry.expiresAt !== null) return 0;
      entry.expiresAt = now + milliseconds;
      return 1;
    },
    async exists(key) {
      return isLocked(key) ? 1 : 0;
    },
    async set(key, _value, _mode, milliseconds) {
      locks.set(key, now + milliseconds);
      return "OK";
    },
    async del(...keys) {
      let removed = 0;
      for (const key of keys) {
        if (counts.delete(key)) removed += 1;
        if (locks.delete(key)) removed += 1;
      }
      return removed;
    },
    advance(ms) {
      now += ms;
    },
  };
}

const key = "someone@iiitl.ac.in";

test("a key locks only after maxAttempts, and the lock expires after lockoutMs", async () => {
  const redis = createFakeRedis();
  const throttle = createThrottle("t", { windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 3 }, redis);

  await throttle.recordAttempt(key);
  await throttle.recordAttempt(key);
  assert.equal(await throttle.isLockedOut(key), false);

  await throttle.recordAttempt(key);
  assert.equal(await throttle.isLockedOut(key), true);

  redis.advance(14 * MINUTE);
  assert.equal(await throttle.isLockedOut(key), true);

  redis.advance(2 * MINUTE);
  assert.equal(await throttle.isLockedOut(key), false);
});

test("attempts spread beyond the window never accumulate into a lock", async () => {
  const redis = createFakeRedis();
  const throttle = createThrottle("t", { windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 3 }, redis);

  await throttle.recordAttempt(key);
  await throttle.recordAttempt(key);
  redis.advance(16 * MINUTE);
  await throttle.recordAttempt(key);

  assert.equal(await throttle.isLockedOut(key), false);
});

test("clearAttempts lifts a lock and resets the count", async () => {
  const redis = createFakeRedis();
  const throttle = createThrottle("t", { windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 2 }, redis);

  await throttle.recordAttempt(key);
  await throttle.recordAttempt(key);
  assert.equal(await throttle.isLockedOut(key), true);

  await throttle.clearAttempts(key);
  assert.equal(await throttle.isLockedOut(key), false);

  // The count was reset too, not just the lock: it takes a fresh
  // maxAttempts to lock out again, not one more.
  await throttle.recordAttempt(key);
  assert.equal(await throttle.isLockedOut(key), false);
});

test("keys are throttled independently", async () => {
  const redis = createFakeRedis();
  const throttle = createThrottle("t", { windowMs: 15 * MINUTE, lockoutMs: 15 * MINUTE, maxAttempts: 2 }, redis);

  await throttle.recordAttempt(key);
  await throttle.recordAttempt(key);
  assert.equal(await throttle.isLockedOut(key), true);
  assert.equal(await throttle.isLockedOut("other@iiitl.ac.in"), false);
});

test("two named throttles sharing one Redis do not collide", async () => {
  const redis = createFakeRedis();
  const login = createThrottle("login", { windowMs: MINUTE, lockoutMs: MINUTE, maxAttempts: 2 }, redis);
  const otp = createThrottle("otp-verify", { windowMs: MINUTE, lockoutMs: MINUTE, maxAttempts: 2 }, redis);

  await login.recordAttempt(key);
  await login.recordAttempt(key);
  assert.equal(await login.isLockedOut(key), true);
  assert.equal(await otp.isLockedOut(key), false);
});

test("a throttle with no Redis configured (null) fails open", async () => {
  const throttle = createThrottle("t", { windowMs: MINUTE, lockoutMs: MINUTE, maxAttempts: 1 }, null);

  await throttle.recordAttempt(key);
  assert.equal(await throttle.isLockedOut(key), false);
  await throttle.clearAttempts(key); // must not throw
});

test("a Redis that rejects every call fails open rather than throwing", async () => {
  const failing: RedisLike = {
    incr: () => Promise.reject(new Error("connection refused")),
    pexpire: () => Promise.reject(new Error("connection refused")),
    exists: () => Promise.reject(new Error("connection refused")),
    set: () => Promise.reject(new Error("connection refused")),
    del: () => Promise.reject(new Error("connection refused")),
  };
  const throttle = createThrottle("t", { windowMs: MINUTE, lockoutMs: MINUTE, maxAttempts: 1 }, failing);

  await throttle.recordAttempt(key); // must not throw
  assert.equal(await throttle.isLockedOut(key), false);
  await throttle.clearAttempts(key); // must not throw
});
