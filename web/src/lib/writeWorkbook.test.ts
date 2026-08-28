import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";
import { writeBudgetWorkbook } from "./writeWorkbook";
import { parseAllSheets } from "./readSheets";
import { SHEET_WRITE_TARGETS } from "./constants";

const FIXTURES = path.join(__dirname, "..", "..", "test", "fixtures");

function loadFixture(name: string) {
  const buffer = fs.readFileSync(path.join(FIXTURES, name));
  return XLSX.read(buffer, { type: "buffer", bookVBA: name.endsWith(".xlsm") });
}

function loadParsedSheets() {
  return parseAllSheets({
    balance: loadFixture("balance.xls"),
    operating: loadFixture("operating.xlsx"),
    reserve: loadFixture("reserve.xlsx"),
    cy: loadFixture("cy.xls"),
    py: loadFixture("py.xls"),
  });
}

describe("writeBudgetWorkbook", () => {
  it("writes all 9 targets and protects every sheet touched", () => {
    const wb = loadFixture("macro.xlsm");
    const parsed = loadParsedSheets();
    const password = "testpass123";

    const result = writeBudgetWorkbook(wb, parsed, password);
    expect(result).toBe(wb); // mutates + returns the same workbook

    const uniqueSheets = [...new Set(SHEET_WRITE_TARGETS.map((t) => t.sheet))];
    expect(uniqueSheets.sort()).toEqual(
      ["CYBalSheet", "CYBudOP", "CYBudRSV", "CYActOP", "CYActRSV", "PYActOP", "PYActRSV"].sort()
    );

    for (const sheetName of uniqueSheets) {
      const ws = wb.Sheets[sheetName];
      expect(ws["!protect"]).toEqual({ password });
    }
  });

  it("writes BS starting at CYBalSheet!B1 with no windowing", () => {
    const wb = loadFixture("macro.xlsm");
    const parsed = loadParsedSheets();
    writeBudgetWorkbook(wb, parsed, "testpass123");

    const ws = wb.Sheets["CYBalSheet"];
    // B1 -> row 0, col 1. First value of BS should land exactly there.
    expect(ws["B1"]?.v).toBe(parsed.BS[0][0]);
    // A second row down confirms the whole matrix was written, not just one cell.
    if (parsed.BS.length > 1 && parsed.BS[1][0] !== null) {
      expect(ws["B2"]?.v).toBe(parsed.BS[1][0]);
    }
  });

  it("writes the CYBudOP window (rows 0-501, cols 2-21) starting at B2", () => {
    const wb = loadFixture("macro.xlsm");
    const parsed = loadParsedSheets();
    writeBudgetWorkbook(wb, parsed, "testpass123");

    const ws = wb.Sheets["CYBudOP"];
    const expectedFirstCell = parsed.OP[0][2]; // window cols start at index 2
    expect(ws["B2"]?.v).toBe(expectedFirstCell);
  });

  it("writes CYActRSV from two different targets (C5 full window, C1 first-5-rows window)", () => {
    const wb = loadFixture("macro.xlsm");
    const parsed = loadParsedSheets();
    writeBudgetWorkbook(wb, parsed, "testpass123");

    const ws = wb.Sheets["CYActRSV"];
    // C5 <- RSV_CY.iloc[0:501, 0:15]
    expect(ws["C5"]?.v).toBe(parsed.RSV_CY[0][0]);
    // C1 <- OP_CY.iloc[0:5, 0:15]
    expect(ws["C1"]?.v).toBe(parsed.OP_CY[0][0]);
  });

  it("throws a labeled error if a target sheet is missing from the workbook", () => {
    const wb = loadFixture("macro.xlsm");
    delete wb.Sheets["CYBalSheet"];
    wb.SheetNames = wb.SheetNames.filter((n) => n !== "CYBalSheet");
    const parsed = loadParsedSheets();

    expect(() => writeBudgetWorkbook(wb, parsed, "testpass123")).toThrow(
      /Sheet 'CYBalSheet' not found/
    );
  });

  it("leaves the VBA project untouched", () => {
    const wb = loadFixture("macro.xlsm");
    const originalVba = wb.vbaraw;
    const parsed = loadParsedSheets();

    writeBudgetWorkbook(wb, parsed, "testpass123");

    expect(wb.vbaraw).toBe(originalVba);
  });
});
