import type { EventBranchGroup, EventCompanyOption } from "@/components/admin/event-form";
import { db } from "@/lib/db";

/** Branches from students whose degree the roster never recorded. */
const UNGROUPED_DEGREE = "Other";

export type EventFormOptions = {
  companies: EventCompanyOption[];
  degrees: string[];
  branchGroups: EventBranchGroup[];
};

/**
 * The choices the event form offers, read from the roster rather than a
 * hardcoded list: a degree or branch is offered because a student holds it, so
 * eligibility can never name a cohort that does not exist.
 *
 * `extraDegrees` and `extraBranches` keep an existing drive editable when its
 * eligibility names a cohort that has since left the roster.
 */
export async function loadEventFormOptions(
  extraDegrees: string[] = [],
  extraBranches: string[] = [],
): Promise<EventFormOptions> {
  const [companies, roster] = await Promise.all([
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: "STUDENT" },
      select: { degree: true, branch: true },
      distinct: ["degree", "branch"],
    }),
  ]);

  const byDegree = new Map<string, Set<string>>();
  for (const degree of [...extraDegrees].filter(Boolean)) {
    byDegree.set(degree, byDegree.get(degree) ?? new Set());
  }
  for (const student of roster) {
    const degree = student.degree?.trim() || UNGROUPED_DEGREE;
    const branches = byDegree.get(degree) ?? new Set<string>();
    if (student.branch?.trim()) branches.add(student.branch.trim());
    byDegree.set(degree, branches);
  }

  // A branch the roster no longer explains still has to be shown, or editing a
  // drive would silently drop it.
  const known = new Set([...byDegree.values()].flatMap((branches) => [...branches]));
  const orphans = extraBranches.filter((branch) => branch && !known.has(branch));
  if (orphans.length) {
    const fallback = byDegree.get(UNGROUPED_DEGREE) ?? new Set<string>();
    orphans.forEach((branch) => fallback.add(branch));
    byDegree.set(UNGROUPED_DEGREE, fallback);
  }

  const degrees = [...byDegree.keys()].sort((a, b) => a.localeCompare(b));

  return {
    companies,
    degrees,
    branchGroups: degrees
      .map((degree) => ({
        degree,
        branches: [...(byDegree.get(degree) ?? [])].sort((a, b) => a.localeCompare(b)),
      }))
      .filter((group) => group.branches.length > 0),
  };
}
