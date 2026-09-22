/**
 * A best-effort, Redis-backed sliding-window-ish throttle: `maxAttempts`
 * inside `windowMs` locks a key out for `lockoutMs`.
 *
 * Shared across every frontend replica through the same Redis the backend's
 * read-through cache uses (`backend/app/core/cache.py`) — this module is
 * that design's counterpart here, and `backend/app/core/rate_limit.py` is
 * its counterpart on the other side, for endpoints with no session to key on
 * (the `/admin` table-browser login, and the identity-document unlock
 * challenge). Before this, the in-process version reset on every deploy and
 * did not coordinate across replicas at all — which replica happened to
 * answer a given request decided which count it saw.
 *
 * It fails open: an unreachable or unconfigured Redis makes `isLockedOut`
 * report `false` and `recordAttempt`/`clearAttempts` no-ops, the same
 * direction `cache.py` fails, but for the opposite reason — a cache miss
 * falls through to a slower, still-correct answer, while a throttle has no
 * equivalent "slower but correct" path when it cannot be read. Refusing
 * sign-in because Redis is unreachable would turn one incident into two.
 *
 * This module itself has no server-only dependency — `redis-client.ts`
 * (real `ioredis`, reads `REDIS_URL`) is only reached through a dynamic
 * `import()`, and only on the path where a caller omits `redis` entirely.
 * `rate-limit.test.ts` always supplies its own in-memory fake, so it never
 * touches that import and needs no Redis to run.
 */

const KEY_PREFIX = "tnp:throttle";

/**
 * The narrow slice of the ioredis API this module calls, so a test can
 * supply an in-memory fake without a real Redis — see rate-limit.test.ts.
 */
export type RedisLike = {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number, mode: "NX"): Promise<number>;
  exists(key: string): Promise<number>;
  set(key: string, value: string, mode: "PX", milliseconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
};

export type Throttle = {
  isLockedOut(key: string): Promise<boolean>;
  /** Counts one attempt toward the window, locking the key out once `maxAttempts` is reached. */
  recordAttempt(key: string): Promise<void>;
  /** Called on success, so a legitimate attempt is not penalised by earlier mistakes. */
  clearAttempts(key: string): Promise<void>;
};

/**
 * Resolves the client to use: the explicit one a caller passed (including
 * `null`, meaning "no Redis, fail open"), or — only when the argument was
 * omitted entirely — the shared production client.
 */
async function resolveRedis(explicit: RedisLike | null | undefined): Promise<RedisLike | null> {
  if (explicit !== undefined) return explicit;
  const { getRedisClient } = await import("@/lib/redis-client");
  return getRedisClient() as unknown as RedisLike | null;
}

/**
 * `name` namespaces this throttle's keys so several can share one Redis
 * without colliding. Omit `redis` to use the shared production client;
 * tests pass an in-memory fake instead.
 */
export function createThrottle(
  name: string,
  options: { windowMs: number; lockoutMs: number; maxAttempts: number },
  redis?: RedisLike | null,
): Throttle {
  const countKey = (key: string) => `${KEY_PREFIX}:${name}:count:${key}`;
  const lockKey = (key: string) => `${KEY_PREFIX}:${name}:lock:${key}`;

  return {
    async isLockedOut(key) {
      const client = await resolveRedis(redis);
      if (!client) return false;
      try {
        return (await client.exists(lockKey(key))) > 0;
      } catch (error) {
        console.warn(`[rate-limit:${name}] lockout check failed, treating as not locked out`, error);
        return false;
      }
    },
    async recordAttempt(key) {
      const client = await resolveRedis(redis);
      if (!client) return;
      try {
        const count = await client.incr(countKey(key));
        // NX, so the window runs from the first attempt rather than the
        // most recent one — same reasoning as cache.py's expire(nx=True).
        await client.pexpire(countKey(key), options.windowMs, "NX");
        if (count >= options.maxAttempts) {
          await client.set(lockKey(key), "1", "PX", options.lockoutMs);
          await client.del(countKey(key));
        }
      } catch (error) {
        console.warn(`[rate-limit:${name}] recording an attempt failed; this attempt was not counted`, error);
      }
    },
    async clearAttempts(key) {
      const client = await resolveRedis(redis);
      if (!client) return;
      try {
        await client.del(countKey(key), lockKey(key));
      } catch (error) {
        console.warn(`[rate-limit:${name}] clearing attempts failed`, error);
      }
    },
  };
}
