import { backendFetch } from "@/lib/api-client";

/**
 * Tells the API to drop its cached copies of data this process just changed.
 *
 * The API caches announcements and events in Redis, but some admin writes
 * still go straight to Postgres through Prisma from here. Those writes are
 * invisible to the API, so without this call a published drive would stay
 * hidden behind the previous list until the cache's TTL expired.
 *
 * Only the topic name crosses the boundary. How a topic maps to Redis keys is
 * the API's business, so the two services cannot drift into disagreeing about
 * the key layout. Drop these calls as the writes themselves move to the API.
 */
export type BackendCacheTopic = "announcements" | "events" | "analytics";

export async function invalidateBackendCache(...topics: BackendCacheTopic[]) {
  if (topics.length === 0) return;

  try {
    await backendFetch("/api/v1/cache/invalidate", {
      method: "POST",
      body: JSON.stringify({ topics }),
    });
  } catch (error) {
    // Deliberately swallowed. The database write it follows has already
    // committed, and reporting it as failed would be wrong and would invite
    // the operator to repeat it. The cost of the miss is bounded: the entry
    // expires on its own, and CACHE_TTL_SECONDS is how long that takes.
    console.warn(
      `Could not clear the ${topics.join(", ")} cache; it will expire on its own.`,
      error,
    );
  }
}
