/**
 * A best-effort, in-process sliding-window throttle: `maxAttempts` inside
 * `windowMs` locks a key out for `lockoutMs`.
 *
 * The counter lives in the process, so it resets on deploy and is not shared
 * between replicas. That is enough to make online guessing impractical at the
 * current single-container deployment; move the counter to Postgres or Redis
 * before running the frontend at more than one replica.
 *
 * Shared by `login-throttle.ts` (locks after repeated wrong passwords) and
 * `registration-otp.ts` (limits how often a code can be requested, and how
 * many wrong guesses a pending code tolerates) — the sliding-window logic is
 * identical, only the thresholds and what counts as "an attempt" differ.
 */

type Record = { count: number; windowStartedAt: number; lockedUntil: number };

export type Throttle = {
  isLockedOut(key: string, now?: number): boolean;
  /** Counts one attempt toward the window, locking the key out once `maxAttempts` is reached. */
  recordAttempt(key: string, now?: number): void;
  clearAttempts(key: string): void;
  reset(): void;
};

export function createThrottle(options: {
  windowMs: number;
  lockoutMs: number;
  maxAttempts: number;
}): Throttle {
  const { windowMs, lockoutMs, maxAttempts } = options;
  const records = new Map<string, Record>();

  function prune(now: number) {
    for (const [key, record] of records) {
      if (record.lockedUntil < now && now - record.windowStartedAt > windowMs) {
        records.delete(key);
      }
    }
  }

  return {
    isLockedOut(key, now = Date.now()) {
      const record = records.get(key);
      return Boolean(record && record.lockedUntil > now);
    },
    recordAttempt(key, now = Date.now()) {
      prune(now);
      const record = records.get(key);
      if (!record || now - record.windowStartedAt > windowMs) {
        records.set(key, { count: 1, windowStartedAt: now, lockedUntil: 0 });
        return;
      }
      record.count += 1;
      if (record.count >= maxAttempts) {
        record.lockedUntil = now + lockoutMs;
        record.count = 0;
        record.windowStartedAt = now;
      }
    },
    clearAttempts(key) {
      records.delete(key);
    },
    reset() {
      records.clear();
    },
  };
}
