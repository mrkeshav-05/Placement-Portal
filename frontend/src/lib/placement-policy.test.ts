import assert from "node:assert/strict";
import test from "node:test";
import {
  BTECH_DREAM_THRESHOLD as BT,
  dreamThreshold,
  isDreamDrive,
  isDreamOffer,
  placementStanding,
  policyAllows,
  type PolicyJob,
  type PolicyOffer,
} from "./placement-policy";

// Same cases as backend/tests/test_placement_policy.py: the two engines must agree.

const offer = (o: Partial<PolicyOffer> = {}): PolicyOffer => ({
  type: "FTE",
  status: "ACCEPTED",
  ctc: null,
  companyName: "Acme",
  companyCategory: null,
  ppoStatus: "PENDING",
  ...o,
});
const job = (j: Partial<PolicyJob> = {}): PolicyJob => ({ type: "FTE", package: null, companyCategory: null, ...j });

const DREAM_FTE = job({ package: 2_000_000 });
const FIRST_ROUND_FTE = job({ package: 800_000 });
const INTERN_DRIVE = job({ type: "INTERNSHIP", package: 50_000 });

test("no offers is open to everything", () => {
  const r = placementStanding([], "B.Tech");
  assert.equal(r.standing, "OPEN");
  for (const d of [DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE]) assert.equal(policyAllows(r, d).allowed, true);
});

test("the Dream line follows the programme", () => {
  assert.equal(dreamThreshold("B.Tech"), 1_000_000);
  for (const degree of ["M.Tech", "m tech", "M.Sc.", "MSc", "MBA", "Ph.D.", "PhD"]) {
    assert.equal(dreamThreshold(degree), 800_000, degree);
  }
  assert.equal(dreamThreshold(null), 1_000_000);
  assert.equal(dreamThreshold("Dual Degree"), 1_000_000);
});

test("the line is inclusive: 10 LPA for B.Tech, 8 LPA for postgraduates", () => {
  assert.equal(isDreamOffer(offer({ ctc: 1_000_000 }), 1_000_000), true);
  assert.equal(isDreamOffer(offer({ ctc: 999_999 }), 1_000_000), false);
  assert.equal(isDreamOffer(offer({ ctc: 800_000 }), 800_000), true);
  assert.equal(isDreamOffer(offer({ ctc: 799_999 }), 800_000), false);
  assert.equal(isDreamDrive(job({ package: 1_000_000 }), BT), true);
});

test("the same 9 LPA offer is First Round for B.Tech and Dream for M.Tech", () => {
  const nine = [offer({ ctc: 900_000 })];
  assert.equal(placementStanding(nine, "B.Tech").standing, "FIRST_ROUND_PLACED");
  assert.equal(placementStanding(nine, "M.Tech").standing, "DREAM_PLACED");
});

test("the same 9 LPA drive is open to a First Round M.Tech but not B.Tech", () => {
  const nineLpaDrive = job({ package: 900_000 });
  assert.equal(policyAllows(placementStanding([offer({ ctc: 700_000 })], "B.Tech"), nineLpaDrive).allowed, false);
  assert.equal(policyAllows(placementStanding([offer({ ctc: 700_000 })], "M.Tech"), nineLpaDrive).allowed, true);
});

test("a Dream offer closes every drive", () => {
  const r = placementStanding([offer({ ctc: 1_500_000 })], "B.Tech");
  assert.equal(r.standing, "DREAM_PLACED");
  for (const d of [DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE]) assert.equal(policyAllows(r, d).allowed, false);
});

test("a Dream PPO counts as Dream", () => {
  assert.equal(placementStanding([offer({ type: "PPO", ctc: 1_800_000 })], "B.Tech").standing, "DREAM_PLACED");
});

test("a First Round offer leaves only Dream drives open", () => {
  const r = placementStanding([offer({ ctc: 900_000 })], "B.Tech");
  assert.equal(r.standing, "FIRST_ROUND_PLACED");
  assert.equal(policyAllows(r, DREAM_FTE).allowed, true);
  assert.equal(policyAllows(r, FIRST_ROUND_FTE).allowed, false);
  assert.match(policyAllows(r, INTERN_DRIVE).reason ?? "", /Internship drives/);
});

test("company category classifies drives and figure-less offers", () => {
  assert.equal(isDreamDrive(job({ type: "INTERNSHIP", companyCategory: "Dream" }), BT), false);
  assert.equal(isDreamDrive(job({ type: "INTERNSHIP_PPO", package: 80_000, companyCategory: "Dream" }), BT), true);
  assert.equal(isDreamOffer(offer({ companyCategory: "Dream" }), BT), true);
  assert.equal(isDreamOffer(offer({ ctc: 600_000, companyCategory: "Dream" }), BT), false);
});

test("declined and revoked offers do not count", () => {
  const r = placementStanding([offer({ ctc: 2_000_000, status: "DECLINED" }), offer({ ctc: 900_000, status: "REVOKED" })], "B.Tech");
  assert.equal(r.standing, "OPEN");
});

test("an internship blocks every drive until its PPO outcome is recorded", () => {
  const r = placementStanding([offer({ type: "INTERNSHIP" })], "B.Tech");
  assert.equal(r.standing, "INTERNING");
  for (const d of [DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE]) assert.equal(policyAllows(r, d).allowed, false);
});

test("no PPO puts the student back in the pool", () => {
  const r = placementStanding([offer({ type: "INTERNSHIP", ppoStatus: "NOT_RECEIVED" })], "B.Tech");
  assert.equal(r.standing, "OPEN");
  for (const d of [DREAM_FTE, FIRST_ROUND_FTE, INTERN_DRIVE]) assert.equal(policyAllows(r, d).allowed, true);
});

test("a received PPO is judged as the PPO offer", () => {
  const internship = offer({ type: "INTERNSHIP", ppoStatus: "RECEIVED" });
  assert.equal(placementStanding([internship, offer({ type: "PPO", ctc: 1_400_000 })], "B.Tech").standing, "DREAM_PLACED");
  assert.equal(placementStanding([internship, offer({ type: "PPO", ctc: 700_000 })], "B.Tech").standing, "FIRST_ROUND_PLACED");
});

test("a pending internship beats a First Round offer, a Dream offer beats a pending internship", () => {
  assert.equal(placementStanding([offer({ ctc: 900_000 }), offer({ type: "INTERNSHIP" })], "B.Tech").standing, "INTERNING");
  assert.equal(placementStanding([offer({ type: "INTERNSHIP" }), offer({ ctc: 2_000_000 })], "B.Tech").standing, "DREAM_PLACED");
});

test("a revoked internship does not block", () => {
  assert.equal(placementStanding([offer({ type: "INTERNSHIP", status: "REVOKED" })], "B.Tech").standing, "OPEN");
});

test("Dream beats First Round and names the best offer", () => {
  const r = placementStanding([offer({ ctc: 900_000, companyName: "Small" }), offer({ ctc: 2_500_000, companyName: "Big" })], "B.Tech");
  assert.equal(r.standing, "DREAM_PLACED");
  assert.equal(r.companyName, "Big");
});
