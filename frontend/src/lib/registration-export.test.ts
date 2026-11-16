import assert from "node:assert/strict";
import test from "node:test";
import { buildExportRows, exportFileLabel, toCsv } from "./registration-export";

type Row = { name: string; roll: string; note: string };
const columns = [
  { id: "sno", label: "S.No", group: "Basic", locked: true, value: (_r: Row, i: number) => i + 1 },
  { id: "name", label: "Name", group: "Basic", locked: true, value: (r: Row) => r.name },
  { id: "roll", label: "Roll", group: "Basic", value: (r: Row) => r.roll },
  { id: "note", label: "Note", group: "Basic", value: (r: Row) => r.note },
];
const rows: Row[] = [
  { name: "Asha", roll: "L1", note: 'says "hi", ok' },
  { name: "Ravi", roll: "L2", note: "=SUM(A1)" },
];

test("an export always carries locked columns and only the ticked others", () => {
  const out = buildExportRows(columns, new Set(["roll"]), rows);
  assert.deepEqual(Object.keys(out[0]), ["S.No", "Name", "Roll"]);
  assert.equal(out[1]["S.No"], 2);
});

test("only the rows passed in are exported, in the order given", () => {
  const out = buildExportRows(columns, new Set(), [rows[1]]);
  assert.equal(out.length, 1);
  assert.equal(out[0].Name, "Ravi");
});

test("CSV quotes delimiters and quotes, and defuses spreadsheet formulas", () => {
  const csv = toCsv(buildExportRows(columns, new Set(["note"]), rows));
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "S.No,Name,Note");
  assert.equal(lines[1], '1,Asha,"says ""hi"", ok"');
  assert.equal(lines[2], "2,Ravi,'=SUM(A1)");
});

test("an empty export still writes its headers", () => {
  assert.equal(toCsv([], ["A", "B"]), "A,B");
});

test("file labels are filename-safe", () => {
  assert.equal(exportFileLabel("Texas Instruments", "Digital Design / Engineer"), "Texas_Instruments_Digital_Design_Engineer");
  assert.equal(exportFileLabel(null), "registrations");
});
