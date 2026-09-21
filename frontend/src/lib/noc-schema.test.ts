import assert from "node:assert/strict";
import test from "node:test";
import {
  nocApproveSchema,
  nocCancelSchema,
  nocFormSchema,
  nocRejectSchema,
  nocVerifySchema,
} from "./noc-schema";

test("nocFormSchema accepts valid submission and trims values", () => {
  const parsed = nocFormSchema.parse({
    company: "  Google India  ",
    city: "  Bengaluru  ",
    address: "  RMZ Infinity, Old Madras Road  ",
    state: "  Karnataka  ",
    pincode: "560016",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    message: "  Summer internship in core search team.  ",
    source: "ON_CAMPUS",
  });

  assert.equal(parsed.company, "Google India");
  assert.equal(parsed.city, "Bengaluru");
  assert.equal(parsed.address, "RMZ Infinity, Old Madras Road");
  assert.equal(parsed.state, "Karnataka");
  assert.equal(parsed.pincode, "560016");
  assert.equal(parsed.message, "Summer internship in core search team.");
  // Defaults to requiring a decision unless explicitly told otherwise.
  assert.equal(parsed.nocRequired, true);
});

test("nocFormSchema rejects end date earlier than start date", () => {
  const res = nocFormSchema.safeParse({
    company: "Google India",
    city: "Bengaluru",
    address: "RMZ Infinity",
    state: "Karnataka",
    pincode: "560016",
    startDate: "2026-08-31",
    endDate: "2026-06-01",
    source: "ON_CAMPUS",
  });

  assert.equal(res.success, false);
});

test("nocFormSchema rejects invalid 5-digit or alphanumeric pincode", () => {
  const invalidDigits = nocFormSchema.safeParse({
    company: "Amazon",
    city: "Hyderabad",
    address: "Financial District",
    state: "Telangana",
    pincode: "50003", // 5 digits
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    source: "ON_CAMPUS",
  });
  assert.equal(invalidDigits.success, false);

  const invalidAlpha = nocFormSchema.safeParse({
    company: "Amazon",
    city: "Hyderabad",
    address: "Financial District",
    state: "Telangana",
    pincode: "50003A", // letters
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    source: "ON_CAMPUS",
  });
  assert.equal(invalidAlpha.success, false);
});

test("nocFormSchema requires a chosen source", () => {
  const res = nocFormSchema.safeParse({
    company: "Amazon",
    city: "Hyderabad",
    address: "Financial District",
    state: "Telangana",
    pincode: "500032",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
  });
  assert.equal(res.success, false);
});

test("nocFormSchema requires a proof document when source is off-campus", () => {
  const base = {
    company: "Atlan",
    city: "Gurugram",
    address: "Sector 44, Cyber City",
    state: "Haryana",
    pincode: "122003",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    source: "OFF_CAMPUS" as const,
  };

  const missingProof = nocFormSchema.safeParse(base);
  assert.equal(missingProof.success, false);

  const withProof = nocFormSchema.safeParse({
    ...base,
    offCampusProofUrl: "/api/v1/uploads/files/noc_offcampus_proof/offer.pdf",
  });
  assert.equal(withProof.success, true);

  // On-campus never needs one.
  const onCampus = nocFormSchema.safeParse({ ...base, source: "ON_CAMPUS" });
  assert.equal(onCampus.success, true);
});

test("nocFormSchema accepts nocRequired: false without a decision workflow", () => {
  const parsed = nocFormSchema.parse({
    company: "Internal Lab",
    city: "Lucknow",
    address: "Institute campus",
    state: "Uttar Pradesh",
    pincode: "226002",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    source: "ON_CAMPUS",
    nocRequired: false,
  });
  assert.equal(parsed.nocRequired, false);
});

test("nocApproveSchema and nocRejectSchema validate parameters properly", () => {
  const validApprove = nocApproveSchema.safeParse({
    nocId: "noc_123",
    adminRemarks: "Approved for summer period",
    documentUrl: "/api/v1/uploads/files/noc_docs/cert.pdf",
  });
  assert.equal(validApprove.success, true);

  const validReject = nocRejectSchema.safeParse({
    nocId: "noc_123",
    adminRemarks: "Company is not verified on our register.",
  });
  assert.equal(validReject.success, true);

  const emptyRejectReason = nocRejectSchema.safeParse({
    nocId: "noc_123",
    adminRemarks: "",
  });
  assert.equal(emptyRejectReason.success, false);

  const cancelValid = nocCancelSchema.safeParse({ nocId: "noc_123" });
  assert.equal(cancelValid.success, true);
});

test("nocVerifySchema validates the toggle payload", () => {
  const valid = nocVerifySchema.safeParse({ nocId: "noc_123", verified: true });
  assert.equal(valid.success, true);

  const missingId = nocVerifySchema.safeParse({ verified: true });
  assert.equal(missingId.success, false);
});

test("a decision never carries the student's own message", () => {
  // `message` belongs to the student. Sending it to a decision must not stand
  // in for the remarks the placement cell is required to write.
  const approve = nocApproveSchema.parse({ nocId: "noc_123", message: "student text" });
  assert.equal(approve.adminRemarks, undefined);
  assert.equal("message" in approve, false);

  const reject = nocRejectSchema.safeParse({ nocId: "noc_123", message: "student text" });
  assert.equal(reject.success, false);
});
