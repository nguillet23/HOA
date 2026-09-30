// Tests run against the real Association Export.xlsx (config/Association
// Export.xlsx, copied into test/fixtures/ — gitignored, real association
// data). Covers parseAssociationsWorkbook only; saveAssociationsFile/
// loadAssociationsRecord go through indexedDB, which isn't available under
// Vitest's default node environment and is exercised via real-browser
// verification instead (see LIVE_WEBSITE_PLAN.md phase 4b).

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";
import { parseAssociationsWorkbook } from "./associations";

const FIXTURES = path.join(__dirname, "..", "..", "test", "fixtures");

function loadFixture(name: string) {
  const buffer = fs.readFileSync(path.join(FIXTURES, name));
  return XLSX.read(buffer, { type: "buffer" });
}

describe("parseAssociationsWorkbook", () => {
  it("parses the real export into {value,label,num} rows, one per data row", () => {
    const wb = loadFixture("associations.xlsx");
    const rows = parseAssociationsWorkbook(wb);
    // Real file: 55 total rows including header -> 54 data rows.
    expect(rows.length).toBe(54);
  });

  it("uses column 0 (Code) for num and column 2 (Nickname) for value/label", () => {
    const wb = loadFixture("associations.xlsx");
    const rows = parseAssociationsWorkbook(wb);
    expect(rows[0]).toEqual({
      value: "Em Overlook-Residential",
      label: "Em Overlook-Residential",
      num: "107111",
    });
  });

  it("throws a labeled error when the sheet has no data rows", () => {
    const empty = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(empty, XLSX.utils.aoa_to_sheet([["Code", "Name", "Nickname"]]), "Sheet1");
    expect(() => parseAssociationsWorkbook(empty)).toThrow(/no association rows/);
  });
});
