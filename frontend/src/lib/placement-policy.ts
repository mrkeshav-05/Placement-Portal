/**
 * The placement cell's one-offer policy, mirrored from
 * `backend/app/services/placement_policy.py`, which enforces it when a student
 * applies. This copy explains a closed Apply button before the round trip and
 * covers the standalone Prisma fallback in `company-events/actions.ts`; the two
 * must give the same answer, and the tests beside each pin the same cases.
 *
 * The Dream line is per programme (Placement Policy §4.1): 10 LPA for B.Tech,
 * 8 LPA for M.Tech / M.Sc. / MBA / Ph.D., inclusive. The same drive can be
 * Dream for one student and First Round for another.
 *
 * - FTE/PPO at or above the student's line → Dream: every on-campus drive is closed.
 * - FTE/PPO below it → First Round: only Dream drives stay open.
 * - An internship (an approved NOC records one) closes every drive until its
 *   PPO outcome is recorded, however long ago it ended. "Not received" frees
 *   the student; "received" is recorded as its own PPO offer and judged by the
 *   lines above. The end date is informational.
 * - Declined and revoked offers count for nothing.
 */

/** Annual CTC in rupees at which an offer or drive is Dream. On the line is Dream. */
export const BTECH_DREAM_THRESHOLD = 1_000_000;
export const POSTGRAD_DREAM_THRESHOLD = 800_000;

const POSTGRAD_DEGREES = new Set(["MTECH", "MSC", "MBA", "PHD"]);

/**
 * The student's Dream line. Degree is free text, so it is compared on letters
 * and digits only; an unset or unrecognised degree reads as B.Tech, the higher
 * line, so an unknown degree never makes a drive Dream the policy would not.
 */
export function dreamThreshold(degree: string | null | undefined): number {
  const key = (degree ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return POSTGRAD_DEGREES.has(key) ? POSTGRAD_DREAM_THRESHOLD : BTECH_DREAM_THRESHOLD;
}

const COUNTED_STATUSES = new Set(["OFFERED", "ACCEPTED"]);
const PLACEMENT_TYPES = new Set(["FTE", "PPO"]);

export type Standing = "OPEN" | "FIRST_ROUND_PLACED" | "DREAM_PLACED" | "INTERNING";

export const STANDING_LABELS: Record<Standing, string> = {
  OPEN: "Open",
  FIRST_ROUND_PLACED: "Placed (First Round)",
  DREAM_PLACED: "Placed (Dream)",
  INTERNING: "Internship (PPO pending)",
};

export type PpoStatus = "PENDING" | "RECEIVED" | "NOT_RECEIVED";

export const PPO_STATUS_LABELS: Record<PpoStatus, string> = {
  PENDING: "PPO pending",
  RECEIVED: "PPO received",
  NOT_RECEIVED: "No PPO",
};

export type PolicyOffer = {
  type: string;
  status: string;
  ctc: number | null;
  companyName: string;
  companyCategory: string | null;
  /** Only read for internships. */
  ppoStatus: string;
};

export type PolicyJob = {
  type: string;
  package: number | null;
  companyCategory: string | null;
};

export type StandingResult = {
  standing: Standing;
  label: string;
  reason: string | null;
  companyName?: string | null;
  ctc?: number | null;
  /** The student's Dream line, in rupees; drives are classified against it. */
  dreamThreshold: number;
};

const isDreamCategory = (category: string | null | undefined) =>
  (category ?? "").trim().toLowerCase() === "dream";

const lpa = (amount: number) =>
  `₹${amount % 100_000 === 0 ? amount / 100_000 : (amount / 100_000).toFixed(2)} LPA`;

export function isDreamOffer(offer: PolicyOffer, threshold: number): boolean {
  if (!PLACEMENT_TYPES.has(offer.type)) return false;
  if (offer.ctc != null) return offer.ctc >= threshold;
  return isDreamCategory(offer.companyCategory);
}

/** An internship-only drive is never Dream: it carries no placement. */
export function isDreamDrive(job: PolicyJob, threshold: number): boolean {
  if (job.type === "INTERNSHIP") return false;
  if (job.package != null && job.package >= threshold) return true;
  return isDreamCategory(job.companyCategory);
}

/** An internship whose PPO outcome the office has not recorded yet. */
export function isPendingInternship(offer: PolicyOffer): boolean {
  return offer.type === "INTERNSHIP" && offer.ppoStatus === "PENDING";
}

export function placementStanding(
  offers: readonly PolicyOffer[],
  degree: string | null | undefined,
): StandingResult {
  const threshold = dreamThreshold(degree);
  const counted = offers.filter((offer) => COUNTED_STATUSES.has(offer.status));

  const dream = counted.filter((offer) => isDreamOffer(offer, threshold));
  if (dream.length) {
    const best = dream.reduce((a, b) => ((b.ctc ?? 0) > (a.ctc ?? 0) ? b : a));
    const pkg = best.ctc != null ? ` (${lpa(best.ctc)})` : "";
    return {
      standing: "DREAM_PLACED",
      label: STANDING_LABELS.DREAM_PLACED,
      reason: `You hold a Dream offer from ${best.companyName}${pkg}, so on-campus applications are closed. An off-campus internship needs an NOC.`,
      companyName: best.companyName,
      ctc: best.ctc,
      dreamThreshold: threshold,
    };
  }

  const interning = counted.filter(isPendingInternship);
  if (interning.length) {
    const current = interning[0];
    return {
      standing: "INTERNING",
      label: STANDING_LABELS.INTERNING,
      reason: `You have an internship with ${current.companyName} whose PPO outcome is not recorded yet, so on-campus applications are closed until the placement cell records it.`,
      companyName: current.companyName,
      dreamThreshold: threshold,
    };
  }

  const placed = counted.filter((offer) => PLACEMENT_TYPES.has(offer.type));
  if (placed.length) {
    const best = placed.reduce((a, b) => ((b.ctc ?? 0) > (a.ctc ?? 0) ? b : a));
    const pkg = best.ctc != null ? ` (${lpa(best.ctc)})` : "";
    return {
      standing: "FIRST_ROUND_PLACED",
      label: STANDING_LABELS.FIRST_ROUND_PLACED,
      reason: `You hold a First Round offer from ${best.companyName}${pkg}. Only Dream drives (${lpa(threshold)} and above) remain open to you.`,
      companyName: best.companyName,
      ctc: best.ctc,
      dreamThreshold: threshold,
    };
  }

  return { standing: "OPEN", label: STANDING_LABELS.OPEN, reason: null, dreamThreshold: threshold };
}

/** Whether the standing permits applying to this drive, and why not if it does not. */
export function policyAllows(result: StandingResult, job: PolicyJob): { allowed: boolean; reason: string | null } {
  if (result.standing === "OPEN") return { allowed: true, reason: null };
  if (result.standing === "FIRST_ROUND_PLACED") {
    if (isDreamDrive(job, result.dreamThreshold)) return { allowed: true, reason: null };
    if (job.type === "INTERNSHIP") {
      return { allowed: false, reason: "Internship drives are closed to students who already hold a full-time offer." };
    }
  }
  return { allowed: false, reason: result.reason };
}
