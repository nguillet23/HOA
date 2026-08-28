// Tests run against the same 5 sample files used to validate the Python
// version (per LIVE_WEBSITE_PLAN.md phase 2), copied into test/fixtures/.
// These are real (if example-labeled) financial exports, so the fixtures
// directory is gitignored rather than committed.

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";
import {
  parseBalanceSheet,
  parseOperatingBudget,
  parseReserveBudget,
  parseAndSplitIncomeStatement,
  parseAllSheets,
} from "./readSheets";
import { COLS_TO_DROP } from "./constants";

const FIXTURES = path.join(__dirname, "..", "..", "test", "fixtures");

// Read via fs + XLSX.read(buffer) rather than XLSX.readFile(path) — the
// latter goes through a different internal path-resolution codepath in
// SheetJS's ESM build that doesn't behave under Vitest's module loader.
function loadFixture(name: string) {
  const buffer = fs.readFileSync(path.join(FIXTURES, name));
  return XLSX.read(buffer, { type: "buffer" });
}

describe("parseBalanceSheet", () => {
  it("reads the BalanceSheet sheet as a raw matrix, unmodified", () => {
    const wb = loadFixture("balance.xls");
    const matrix = parseBalanceSheet(wb);
    // Source sheet is A1:D55 -> 55 rows, 4 cols, no column drop applied.
    expect(matrix.length).toBe(55);
    expect(matrix[0].length).toBe(4);
  });

  it("throws a labeled error if the BalanceSheet sheet is missing", () => {
    const wb = { SheetNames: ["Other"], Sheets: { Other: {} } } as unknown as XLSX.WorkBook;
    expect(() => parseBalanceSheet(wb)).toThrow(/BalanceSheet/);
  });
});

describe("parseOperatingBudget / parseReserveBudget", () => {
  it("drops column index 6 from the Operating Budget Export", () => {
    const wb = loadFixture("operating.xlsx");
    const before = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, defval: null }) as unknown[][];
    const after = parseOperatingBudget(wb);

    expect(after.length).toBe(before.length);
    expect(after[0].length).toBe(before[0].length - 1);
    // The dropped column's header ("% Change Inc/Dec") must not survive at
    // its old position, and everything after it should shift left by one.
    expect(before[0][6]).toBe("% Change Inc/Dec");
    expect(after[0][6]).toBe(before[0][7]);
  });

  it("drops column index 6 from the Reserve Budget Export the same way", () => {
    const wb = loadFixture("reserve.xlsx");
    const before = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { header: 1, defval: null }) as unknown[][];
    const after = parseReserveBudget(wb);

    expect(after.length).toBe(before.length);
    expect(after[0].length).toBe(before[0].length - 1);
  });
});

describe("parseAndSplitIncomeStatement", () => {
  it("splits the CY Income Statement at 'Operating Net Total ' after dropping COLS_TO_DROP", () => {
    const wb = loadFixture("cy.xls");
    const before = XLSX.utils.sheet_to_json(wb.Sheets["Income Statement"], {
      header: 1,
      defval: null,
    }) as unknown[][];
    const rawRowIdx = before.findIndex((row) => row[0] === "Operating Net Total ");
    expect(rawRowIdx).toBeGreaterThan(-1); // sanity: fixture actually has this row

    const { operating, reserve } = parseAndSplitIncomeStatement(wb, "Current Year Income Statement");

    // Column count shrinks by exactly COLS_TO_DROP.length.
    expect(operating[0].length).toBe(before[0].length - COLS_TO_DROP.length);
    expect(reserve[0].length).toBe(before[0].length - COLS_TO_DROP.length);

    // Row split: operating = [0, rowIdx], reserve = [rowIdx, ...] — both
    // halves contain the pivot row, matching the Python .iloc slices.
    expect(operating.length).toBe(rawRowIdx + 1);
    expect(operating[operating.length - 1][0]).toBe("Operating Net Total ");
    expect(reserve[0][0]).toBe("Operating Net Total ");
    expect(reserve.length).toBe(Math.min(500, before.length) - rawRowIdx);
  });

  it("splits the PY Income Statement the same way", () => {
    const wb = loadFixture("py.xls");
    const before = XLSX.utils.sheet_to_json(wb.Sheets["Income Statement"], { header: 1 }) as unknown[][];
    const rawRowIdx = before.findIndex((row) => row[0] === "Operating Net Total ");

    const { operating, reserve } = parseAndSplitIncomeStatement(wb, "Prior Year Income Statement");

    expect(operating.length).toBe(rawRowIdx + 1);
    expect(reserve[0][0]).toBe("Operating Net Total ");
  });

  it("throws a labeled error when the pivot row is absent", () => {
    const wb = loadFixture("cy.xls");
    // Mutate a clone so the pivot label is gone.
    const ws = XLSX.utils.sheet_to_json(wb.Sheets["Income Statement"], { header: 1 }) as unknown[][];
    const mutated = ws.map((row) => (row[0] === "Operating Net Total " ? ["Something Else", ...row.slice(1)] : row));
    const newSheet = XLSX.utils.aoa_to_sheet(mutated);
    const newWb: XLSX.WorkBook = { SheetNames: ["Income Statement"], Sheets: { "Income Statement": newSheet } };

    expect(() => parseAndSplitIncomeStatement(newWb, "Current Year Income Statement")).toThrow(
      /could not find 'Operating Net Total' row/
    );
  });
});

describe("parseAllSheets", () => {
  it("runs the full 5-file pipeline end to end against the real fixtures", () => {
    const result = parseAllSheets({
      balance: loadFixture("balance.xls"),
      operating: loadFixture("operating.xlsx"),
      reserve: loadFixture("reserve.xlsx"),
      cy: loadFixture("cy.xls"),
      py: loadFixture("py.xls"),
    });

    expect(result.BS.length).toBeGreaterThan(0);
    expect(result.OP.length).toBeGreaterThan(0);
    expect(result.RSV.length).toBeGreaterThan(0);
    expect(result.OP_CY[result.OP_CY.length - 1][0]).toBe("Operating Net Total ");
    expect(result.RSV_CY[0][0]).toBe("Operating Net Total ");
    expect(result.OP_PY[result.OP_PY.length - 1][0]).toBe("Operating Net Total ");
    expect(result.RSV_PY[0][0]).toBe("Operating Net Total ");
  });
});
