import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRupees,
  formatStipend,
  isCtcType,
  offerBulkFormSchema,
  offerFormSchema,
  parseRollNumbers,
} from "./offer-schema";

const base = {
  userId: "usr_1",
  companyId: "cmp_1",
  batch: "2027",
  status: "OFFERED",
};

test("a placement offer requires an annual CTC", () => {
  const missing = offerFormSchema.safeParse({ ...base, type: "FTE" });
  assert.equal(missing.success, false);
  assert.equal(missing.error?.issues[0]?.path[0], "ctc");

  const valid = offerFormSchema.safeParse({ ...base, type: "FTE", ctc: "1800000" });
  assert.equal(valid.success, true);
  assert.equal(valid.data?.ctc, 1_800_000);
});

test("an internship requires a monthly stipend", () => {
  const missing = offerFormSchema.safeParse({ ...base, type: "INTERNSHIP" });
  assert.equal(missing.success, false);
  assert.equal(missing.error?.issues[0]?.path[0], "stipend");

  const valid = offerFormSchema.safeParse({ ...base, type: "INTERNSHIP", stipend: "75000" });
  assert.equal(valid.success, true);
  assert.equal(valid.data?.stipend, 75_000);
});

test("an offer keeps only the amount its type uses", () => {
  // Re-recording an internship as a full-time offer must not leave the old
  // monthly stipend sitting on the row, where the dashboard would average it.
  const parsed = offerFormSchema.parse({
    ...base,
    type: "FTE",
    ctc: "2400000",
    stipend: "50000",
  });
  assert.equal(parsed.ctc, 2_400_000);
  assert.equal(parsed.stipend, null);

  const internship = offerFormSchema.parse({
    ...base,
    type: "INTERNSHIP",
    ctc: "2400000",
    stipend: "50000",
  });
  assert.equal(internship.ctc, null);
  assert.equal(internship.stipend, 50_000);
});

test("a pre-placement offer is priced like a placement", () => {
  assert.equal(isCtcType("PPO"), true);
  assert.equal(isCtcType("INTERNSHIP"), false);

  const ppo = offerFormSchema.safeParse({ ...base, type: "PPO", ctc: "2000000" });
  assert.equal(ppo.success, true);
});

test("the season must be a four-digit year and the student and company are required", () => {
  assert.equal(
    offerFormSchema.safeParse({ ...base, batch: "27", type: "FTE", ctc: "10" }).success,
    false,
  );
  assert.equal(
    offerFormSchema.safeParse({ ...base, userId: "", type: "FTE", ctc: "10" }).success,
    false,
  );
  assert.equal(
    offerFormSchema.safeParse({ ...base, companyId: "", type: "FTE", ctc: "10" }).success,
    false,
  );
});

test("a pasted roll-number list survives whatever the spreadsheet produced", () => {
  // Commas, spaces, tabs, newlines, and semicolons all appear in real pastes,
  // often mixed in the same one.
  assert.deepEqual(parseRollNumbers("2023UCS1632, 2023UME4018"), [
    "2023UCS1632",
    "2023UME4018",
  ]);
  assert.deepEqual(parseRollNumbers("2023UCS1632\n2023UME4018\t2023UEE4661"), [
    "2023UCS1632",
    "2023UME4018",
    "2023UEE4661",
  ]);
  assert.deepEqual(parseRollNumbers("2023ucs1632; 2023ume4018"), [
    "2023UCS1632",
    "2023UME4018",
  ]);
});

test("roll numbers are de-duplicated in the order they were entered", () => {
  // The same student cannot hold the same record twice, so a repeat in the
  // paste is the office's typo rather than a second record.
  assert.deepEqual(parseRollNumbers("  B ,a,  A ,b,a "), ["B", "A"]);
  assert.deepEqual(parseRollNumbers("   "), []);
  assert.deepEqual(parseRollNumbers(""), []);
});

test("a bulk run needs a company, a job title, an amount, and at least one student", () => {
  const complete = {
    companyId: "cmp_1",
    type: "FTE",
    status: "OFFERED",
    jobTitle: "Associate Engineer",
    batch: "2027",
    ctc: "1800000",
    rollNumbers: ["2023UCS1632"],
  };
  assert.equal(offerBulkFormSchema.safeParse(complete).success, true);

  for (const [field, value] of [
    ["companyId", ""],
    ["jobTitle", "   "],
    ["rollNumbers", []],
  ] as const) {
    const parsed = offerBulkFormSchema.safeParse({ ...complete, [field]: value });
    assert.equal(parsed.success, false, `${field} should be required`);
  }
});

test("a bulk run prices itself by type, exactly as a single record does", () => {
  const base = {
    companyId: "cmp_1",
    status: "ACCEPTED",
    jobTitle: "Summer Intern",
    batch: "2027",
    rollNumbers: ["2023UCS1632", "2023UME4018"],
  };

  const missingStipend = offerBulkFormSchema.safeParse({ ...base, type: "INTERNSHIP" });
  assert.equal(missingStipend.success, false);
  assert.equal(missingStipend.error?.issues[0]?.path[0], "stipend");

  // The amount that does not belong to the type is dropped, so a whole paste
  // cannot land with a stipend the dashboard would average as a salary.
  const internship = offerBulkFormSchema.parse({
    ...base,
    type: "INTERNSHIP",
    ctc: "1800000",
    stipend: "50000",
  });
  assert.equal(internship.ctc, null);
  assert.equal(internship.stipend, 50_000);
  assert.equal(internship.rollNumbers.length, 2);
});

test("packages read in the units the office uses", () => {
  assert.equal(formatRupees(1_800_000), "₹18.00 LPA");
  assert.equal(formatRupees(12_500_000), "₹1.25 Cr");
  assert.equal(formatRupees(45_000), "₹45,000");
  assert.equal(formatRupees(null), "—");
  assert.equal(formatStipend(75_000), "₹75,000/month");
  assert.equal(formatStipend(null), "—");
});
