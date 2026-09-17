import assert from "node:assert/strict";
import test from "node:test";
import { jobProfileFormSchema } from "./job-profile-schema";

const validInput = {
  id: "",
  companyId: "cm12345678901234567890123",
  title: "Software Engineer",
  type: "FTE",
  locations: "Bengaluru, Bengaluru, Remote",
  ctcStipend: "1800000",
  ctcStipendInfo: "Annual CTC",
  minCGPA: "7.5",
  maxBacklogs: "0",
  maxBans: "0",
  allowedBranches: JSON.stringify(["CSE", "IT", "CSE"]),
  allowedDegrees: JSON.stringify(["BTech"]),
  allowedGenders: "[]",
  jobCategory: "Tech",
  batch: "2027",
  placementYear: "2026",
  registrationDeadline: "2099-12-31T23:59",
  status: "ACTIVE",
  description: "Build reliable products.",
  openingOverview: "Graduate engineering role.",
  cap: "",
  companyBond: "2 years",
  duration: "",
  redirectUrl: "",
};

test("job profile input normalizes numbers, posting places, and picked lists", () => {
  const parsed = jobProfileFormSchema.parse(validInput);
  assert.equal(parsed.ctcStipend, 1_800_000);
  assert.deepEqual(parsed.locations, ["Bengaluru", "Remote"]);
  assert.deepEqual(parsed.allowedBranches, ["CSE", "IT"]);
  assert.equal(parsed.allowedGenders.length, 0);
  assert.equal(parsed.placementYear, 2026);
  assert.equal(parsed.cap, null);
  assert.equal(parsed.companyBond, "2 years");
});

test("a comma-separated eligibility list still parses", () => {
  const parsed = jobProfileFormSchema.parse({
    ...validInput,
    allowedBranches: "CSE, IT",
    allowedDegrees: "BTech, MTech",
  });
  assert.deepEqual(parsed.allowedDegrees, ["BTech", "MTech"]);
});

test("active jobs reject deadlines in the past", () => {
  const parsed = jobProfileFormSchema.safeParse({
    ...validInput,
    registrationDeadline: "2020-01-01T00:00",
  });
  assert.equal(parsed.success, false);
  assert.match(parsed.error?.issues[0]?.message ?? "", /future deadline/i);
});

test("job profiles require at least one branch and degree", () => {
  const parsed = jobProfileFormSchema.safeParse({
    ...validInput,
    allowedBranches: "[]",
    allowedDegrees: "[]",
  });
  assert.equal(parsed.success, false);
});

test("the category is a closed list, so Core is refused", () => {
  const parsed = jobProfileFormSchema.safeParse({ ...validInput, jobCategory: "Core" });
  assert.equal(parsed.success, false);
});

test("a redirect link must be a full URL", () => {
  assert.equal(
    jobProfileFormSchema.safeParse({ ...validInput, redirectUrl: "careers.example.com" }).success,
    false,
  );
  assert.equal(
    jobProfileFormSchema.parse({ ...validInput, redirectUrl: "https://careers.example.com/apply" })
      .redirectUrl,
    "https://careers.example.com/apply",
  );
});
