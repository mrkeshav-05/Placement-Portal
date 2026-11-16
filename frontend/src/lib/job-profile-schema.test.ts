import assert from "node:assert/strict";
import test from "node:test";
import { employmentFlags, jobProfileFormSchema } from "./job-profile-schema";

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
  allowedBranches: JSON.stringify(["CS", "IT", "CS"]),
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
  assert.deepEqual(parsed.allowedBranches, ["CS", "IT"]);
  assert.equal(parsed.allowedGenders.length, 0);
  assert.equal(parsed.placementYear, 2026);
  assert.equal(parsed.companyBond, "2 years");
});

test("a comma-separated eligibility list still parses", () => {
  const parsed = jobProfileFormSchema.parse({
    ...validInput,
    allowedBranches: "CS, IT",
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

test("a legacy CSE branch is saved as CS, without a duplicate", () => {
  const parsed = jobProfileFormSchema.parse({
    ...validInput,
    allowedBranches: JSON.stringify(["CSE", "IT", "CS", " cse "]),
  });
  assert.deepEqual(parsed.allowedBranches, ["CS", "IT"]);
});

test("JAF details left out stay null, never defaulting to No", () => {
  const parsed = jobProfileFormSchema.parse(validInput);
  assert.equal(parsed.jaf.hasBond, null);
  assert.equal(parsed.jaf.compensation, null);
  assert.equal(parsed.jaf.selectionRounds, null);
  assert.equal(parsed.jaf.jdFile, null);
  assert.equal(parsed.jaf.workMode, null);
});

test("JAF details keep only what was filled in", () => {
  const parsed = jobProfileFormSchema.parse({
    ...validInput,
    jaf: JSON.stringify({
      workMode: "HYBRID",
      joiningDate: "  July 2027 ",
      ppoCtcLpa: "",
      compensation: {
        "B.Tech.": { fixed: "1000000", variable: "", ctc: "1200000" },
        "M.Tech.": { fixed: "", variable: "", ctc: "" },
      },
      selectionRounds: {
        aptitudeTest: { conducted: true, duration: "60 min", rounds: "1", sequence: "" },
        hrInterview: { conducted: null, duration: "", rounds: "", sequence: "" },
      },
      jdFile: { fileName: "jd.pdf", fileUrl: "/api/v1/uploads/files/event_docs/a.pdf", mimeType: "application/pdf", sizeBytes: 1200 },
    }),
  });
  assert.equal(parsed.jaf.workMode, "HYBRID");
  assert.equal(parsed.jaf.joiningDate, "July 2027");
  assert.equal(parsed.jaf.ppoCtcLpa, null);
  assert.deepEqual(parsed.jaf.compensation, { "B.Tech.": { fixed: 1000000, ctc: 1200000 } });
  assert.deepEqual(parsed.jaf.selectionRounds, { aptitudeTest: { conducted: true, duration: "60 min", rounds: 1 } });
  assert.equal(parsed.jaf.jdFile?.fileName, "jd.pdf");
});

test("an unknown work mode is rejected", () => {
  const result = jobProfileFormSchema.safeParse({ ...validInput, jaf: JSON.stringify({ workMode: "ANYWHERE" }) });
  assert.equal(result.success, false);
});

test("each employment type asks only for the compensation fields it uses", () => {
  assert.deepEqual(employmentFlags("FTE"), { stipend: false, duration: false, expectedCtc: false, fullTime: true });
  assert.deepEqual(employmentFlags("INTERNSHIP"), { stipend: true, duration: true, expectedCtc: false, fullTime: false });
  assert.deepEqual(employmentFlags("INTERNSHIP_PPO"), { stipend: true, duration: true, expectedCtc: true, fullTime: true });
  assert.deepEqual(employmentFlags("INTERNSHIP_FTE"), { stipend: true, duration: true, expectedCtc: true, fullTime: true });
  assert.equal(employmentFlags("").fullTime, false);
});
