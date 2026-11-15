import assert from "node:assert/strict";
import test from "node:test";
import { interviewExperienceFormSchema } from "./interview-experience-schema";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    companyName: "  Amazon India  ",
    role: "  SDE-1  ",
    batch: "2026",
    interviewType: "  On-Campus  ",
    opportunityType: "INTERN_FTE",
    dsaQuestions: "  Reverse a linked list, LRU cache design.  ",
    ...overrides,
  };
}

test("interviewExperienceFormSchema accepts a valid submission and trims values", () => {
  const parsed = interviewExperienceFormSchema.parse(validPayload());

  assert.equal(parsed.companyName, "Amazon India");
  assert.equal(parsed.role, "SDE-1");
  assert.equal(parsed.batch, 2026);
  assert.equal(parsed.interviewType, "On-Campus");
  assert.equal(parsed.dsaQuestions, "Reverse a linked list, LRU cache design.");
});

test("interviewExperienceFormSchema converts blank optional sections to null", () => {
  const parsed = interviewExperienceFormSchema.parse(
    validPayload({ hrQuestions: "   ", tips: "" })
  );
  assert.equal(parsed.hrQuestions, null);
  assert.equal(parsed.tips, null);
});

test("interviewExperienceFormSchema rejects a submission with no question content at all", () => {
  const res = interviewExperienceFormSchema.safeParse({
    companyName: "Google",
    role: "SWE",
    batch: "2026",
    interviewType: "Off-Campus",
    opportunityType: "FTE",
  });
  assert.equal(res.success, false);
});

test("interviewExperienceFormSchema rejects a short company name or invalid batch", () => {
  const shortCompany = interviewExperienceFormSchema.safeParse(validPayload({ companyName: "A" }));
  assert.equal(shortCompany.success, false);

  const invalidBatch = interviewExperienceFormSchema.safeParse(validPayload({ batch: "1899" }));
  assert.equal(invalidBatch.success, false);
});

test("interviewExperienceFormSchema requires an opportunity type", () => {
  const base = {
    companyName: "Amazon",
    role: "SDE",
    batch: 2027,
    interviewType: "On-Campus",
    dsaQuestions: "Two sum",
  };
  assert.equal(interviewExperienceFormSchema.safeParse(base).success, false);
  assert.equal(
    interviewExperienceFormSchema.safeParse({ ...base, opportunityType: "INTERN_FTE" }).success,
    true,
  );
  assert.equal(
    interviewExperienceFormSchema.safeParse({ ...base, opportunityType: "FULL" }).success,
    false,
  );
});
