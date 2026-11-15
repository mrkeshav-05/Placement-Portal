import "server-only";
import { backendFetch } from "@/lib/api-client";
import { BTECH_DREAM_THRESHOLD, type StandingResult } from "@/lib/placement-policy";

/**
 * The signed-in student's placement-policy standing, from FastAPI. Null when
 * the backend cannot answer: callers then show no policy verdict, and the
 * apply endpoint still enforces the rule on submission.
 */
export async function fetchStudentStanding(): Promise<StandingResult | null> {
  try {
    const standing = await backendFetch<StandingResult>("/api/v1/applications/standing");
    return { ...standing, dreamThreshold: standing.dreamThreshold ?? BTECH_DREAM_THRESHOLD };
  } catch {
    return null;
  }
}
