import assert from "node:assert/strict";
import test from "node:test";
import { COMPANY_CATEGORIES, companyFormSchema } from "./company-schema";

const valid = {
  id: "",
  name: "  Example Technologies  ",
  category: "Dream",
  placementSession: "2027",
  turnover: "  ",
  description: "  Product engineering company.  ",
};

test("company input trims real values and normalizes a blank turnover", () => {
  const parsed = companyFormSchema.parse(valid);

  assert.equal(parsed.name, "Example Technologies");
  assert.equal(parsed.description, "Product engineering company.");
  assert.equal(parsed.placementSession, 2027);
  assert.equal(parsed.turnover, null);
});

test("company category is a closed list", () => {
  assert.deepEqual([...COMPANY_CATEGORIES], ["Dream", "First Round"]);
  assert.equal(companyFormSchema.safeParse({ ...valid, category: "A++" }).success, false);
  assert.equal(companyFormSchema.safeParse({ ...valid, category: "" }).success, false);
});

test("company info is required, so a record cannot be saved as a bare name", () => {
  assert.equal(companyFormSchema.safeParse({ ...valid, description: "   " }).success, false);
});

test("placement session must be a plausible year", () => {
  assert.equal(companyFormSchema.safeParse({ ...valid, placementSession: "1999" }).success, false);
  assert.equal(companyFormSchema.safeParse({ ...valid, placementSession: "" }).success, false);
});

test("turnover is kept as the company states it", () => {
  const parsed = companyFormSchema.parse({ ...valid, turnover: "  USD 4.2 billion  " });
  assert.equal(parsed.turnover, "USD 4.2 billion");
});
