import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKLOG_OPTIONS,
  BLOOD_GROUPS,
  GENDERS,
  studentAcademicCorrectionSchema,
  studentProfileSchema,
} from "./profile-schema";

/** The form posts every field, so a partial payload is not a realistic input. */
const EMPTY = {
  personalEmail: "",
  contactNumber: "",
  altContactNumber: "",
  gender: "",
  bloodGroup: "",
  dateOfBirth: "",
  currentAddress: "",
  class10Percent: "",
  class12Percent: "",
  cgpa: "",
  backlogs: "0",
};

function parse(field: string, value: unknown) {
  return studentProfileSchema.safeParse({ ...EMPTY, [field]: value });
}

function accepted(field: string, value: unknown) {
  const result = parse(field, value);
  assert.ok(result.success, `expected ${field}=${JSON.stringify(value)} to be accepted`);
  return (result.data as Record<string, unknown>)[field];
}

function rejected(field: string, value: unknown) {
  const result = parse(field, value);
  assert.equal(result.success, false, `expected ${field}=${JSON.stringify(value)} to be rejected`);
}

test("percentages accept 0 to 100 with up to two decimal places", () => {
  for (const value of ["0", "50", "87.65", "99.99", "100", "100.00"]) {
    assert.equal(typeof accepted("class10Percent", value), "number");
  }
  // Stored as a number, not a string, and never with a "%" appended.
  assert.equal(accepted("class10Percent", "87.65"), 87.65);
  assert.equal(accepted("class12Percent", "100.00"), 100);
});

test("percentages reject out-of-range, over-precise, and non-numeric values", () => {
  for (const value of ["-1", "100.01", "105", "120", "87.653", "abc", "1e3"]) {
    rejected("class10Percent", value);
    rejected("class12Percent", value);
  }
});

test("precision is counted on the digits sent, not on the binary float", () => {
  // 87.65 has no exact binary representation; a modular check against 0.01
  // rejects it. These must all survive.
  for (const value of ["0.07", "1.01", "8.15", "29.99", "87.65", "99.95"]) {
    assert.equal(accepted("class10Percent", value), Number(value));
  }
});

test("gender and blood group accept only their listed values", () => {
  for (const value of GENDERS) assert.equal(accepted("gender", value), value);
  for (const value of BLOOD_GROUPS) assert.equal(accepted("bloodGroup", value), value);

  for (const value of ["Other", "male", "MALE", "M", "anything"]) rejected("gender", value);
  for (const value of ["C+", "a+", "O positive", "AB"]) rejected("bloodGroup", value);
});

test("gender and blood group stay optional and clearable", () => {
  assert.equal(accepted("gender", ""), null);
  assert.equal(accepted("bloodGroup", ""), null);
});

test("a percentage is only bounded by its own scale", () => {
  // CGPA shares the precision rule but is out of 10, not 100.
  assert.equal(accepted("cgpa", "9.75"), 9.75);
  rejected("cgpa", "10.01");
  rejected("cgpa", "8.765");
});

test("backlogs accepts 0 through 20 as a number", () => {
  assert.equal(BACKLOG_OPTIONS.length, 21);
  assert.equal(BACKLOG_OPTIONS[0], "0");
  assert.equal(BACKLOG_OPTIONS[20], "20");

  for (const value of BACKLOG_OPTIONS) {
    const parsed = accepted("backlogs", value);
    assert.equal(typeof parsed, "number");
    assert.equal(parsed, Number(value));
  }
});

test("backlogs rejects values outside the list", () => {
  for (const value of ["21", "100", "-1", "3.5", "abc"]) rejected("backlogs", value);
});

test("the roster-owned fields are still unwritable, but a student can set their own cgpa and backlogs", () => {
  const result = studentProfileSchema.safeParse({
    ...EMPTY,
    name: "Someone Else",
    rollNumber: "FAKE9999",
    branch: "FAKE",
    degree: "PhD",
    batch: 1999,
    cgpa: "9.5",
    backlogs: "2",
  });
  assert.ok(result.success);
  const data = result.data as Record<string, unknown>;
  for (const key of ["name", "rollNumber", "branch", "degree", "batch"]) {
    assert.equal(key in data, false);
  }
  assert.equal(data.cgpa, 9.5);
  assert.equal(data.backlogs, 2);
});

test("studentAcademicCorrectionSchema: cgpa shares the precision rule but is out of 10", () => {
  const parse = (cgpa: unknown) => studentAcademicCorrectionSchema.safeParse({ cgpa, backlogs: "" });
  assert.equal(parse("9.75").success && parse("9.75").data?.cgpa, 9.75);
  assert.equal(parse("10.01").success, false);
  assert.equal(parse("8.765").success, false);
});

test("studentAcademicCorrectionSchema: backlogs accepts 0 through 20 as a number", () => {
  assert.equal(BACKLOG_OPTIONS.length, 21);
  assert.equal(BACKLOG_OPTIONS[0], "0");
  assert.equal(BACKLOG_OPTIONS[20], "20");

  for (const value of BACKLOG_OPTIONS) {
    const result = studentAcademicCorrectionSchema.safeParse({ cgpa: "", backlogs: value });
    assert.ok(result.success, `expected backlogs=${value} to be accepted`);
    assert.equal(typeof result.data?.backlogs, "number");
    assert.equal(result.data?.backlogs, Number(value));
  }
});

test("studentAcademicCorrectionSchema: backlogs rejects values outside the list", () => {
  for (const value of ["21", "100", "-1", "3.5", "abc"]) {
    assert.equal(
      studentAcademicCorrectionSchema.safeParse({ cgpa: "", backlogs: value }).success,
      false,
      `expected backlogs=${value} to be rejected`,
    );
  }
});

test("studentAcademicCorrectionSchema: either field can be corrected independently", () => {
  const cgpaOnly = studentAcademicCorrectionSchema.safeParse({ cgpa: "8.5", backlogs: "" });
  assert.ok(cgpaOnly.success);
  assert.equal(cgpaOnly.data?.cgpa, 8.5);
  assert.equal(cgpaOnly.data?.backlogs, null);

  const backlogsOnly = studentAcademicCorrectionSchema.safeParse({ cgpa: "", backlogs: "2" });
  assert.ok(backlogsOnly.success);
  assert.equal(backlogsOnly.data?.cgpa, null);
  assert.equal(backlogsOnly.data?.backlogs, 2);
});
