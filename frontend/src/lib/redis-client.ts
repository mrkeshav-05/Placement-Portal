import "server-only";

import Redis from "ioredis";

/**
 * The shared throttle client, or `null` when `REDIS_URL` is unset.
 *
 * Mirrors `backend/app/core/cache.py`'s `_get_client()`: built once, lazily,
 * and never rebuilt. Short timeouts and a retry strategy that gives up
 * immediately keep an unreachable Redis from adding latency to every
 * request that checks a throttle — callers treat any failure as "fail
 * open," so a slow retry would only make the degraded state slower without
 * making it any more correct.
 */

let client: Redis | null | undefined; // undefined = not yet built

export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    client = null;
    return null;
  }

  client = new Redis(url, {
    connectTimeout: 250,
    commandTimeout: 250,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: false,
  });

  // ioredis emits "error" on every failed connection/reconnect attempt;
  // an unhandled one is a fatal, process-crashing event in Node. Callers
  // already catch per-command failures and fail open, so this listener
  // exists only to keep the process alive while Redis is unreachable.
  client.on("error", () => {});

  return client;
}
