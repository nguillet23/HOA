import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import path from "node:path";
import fs from "node:fs";
import { buildOutputZip } from "./zipOutput";
import { writeBudgetWorkbook } from "./writeWorkbook";
import { parseAllSheets } from "./readSheets";

const FIXTURES = path.join(__dirname, "..", "..", "test", "fixtures");

function loadWorkbook(name: string) {
  const buffer = fs.readFileSync(path.join(FIXTURES, name));
  return XLSX.read(buffer, { type: "buffer", bookVBA: name.endsWith(".xlsm") });
}

// Vitest runs in Node, so `File` needs a stand-in with the same surface
// zipOutput.ts relies on (`.name`, `.arrayBuffer()`).
function fixtureAsFile(name: string): File {
  const buffer = fs.readFileSync(path.join(FIXTURES, name));
  return new File([buffer], name);
}

async function buildRealZip() {
  const parsed = parseAllSheets({
    balance: loadWorkbook("balance.xls"),
    operating: loadWorkbook("operating.xlsx"),
    reserve: loadWorkbook("reserve.xlsx"),
    cy: loadWorkbook("cy.xls"),
    py: loadWorkbook("py.xls"),
  });

  const targetWb = loadWorkbook("macro.xlsm");
  writeBudgetWorkbook(targetWb, parsed, "testpass123");

  return buildOutputZip({
    targetWorkbook: targetWb,
    targetFileName: "Budget - Example.xlsm",
    sourceFiles: {
      balance: fixtureAsFile("balance.xls"),
      operating: fixtureAsFile("operating.xlsx"),
      reserve: fixtureAsFile("reserve.xlsx"),
      cy: fixtureAsFile("cy.xls"),
      py: fixtureAsFile("py.xls"),
    },
    association: "Spire Master Condominium Association",
    number: "1234",
    month: "08",
    year: "2026",
    budgetYear: "2026",
  });
}

describe("buildOutputZip", () => {
  it("names the zip and its 6 entries per the handlers_process.py naming scheme", async () => {
    const { zipFilename, outputFiles } = await buildRealZip();

    expect(zipFilename).toBe("1234_Spire Master Condominium Association_2026_08_Budget_Output.zip");
    expect(outputFiles).toEqual([
      { src: "Budget - Example.xlsm", dst: "2026_Spire Master Condominium Association_Budget.xlsm" },
      { src: "balance.xls", dst: "1234_Spire Master Condominium Association_Balance_Sheet_2026_08.xls" },
      { src: "operating.xlsx", dst: "1234_Spire Master Condominium Association_Budget_Export_OP.xlsx" },
      { src: "reserve.xlsx", dst: "1234_Spire Master Condominium Association_Budget_Export_RSV.xlsx" },
      { src: "cy.xls", dst: "1234_Spire Master Condominium Association_Income_Statement_CY.xls" },
      { src: "py.xls", dst: "1234_Spire Master Condominium Association_Income_Statement_PY.xls" },
    ]);
  });

  it("produces a real zip containing all 6 files by their new names", async () => {
    const { blob } = await buildRealZip();
    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(
      [
        "2026_Spire Master Condominium Association_Budget.xlsm",
        "1234_Spire Master Condominium Association_Balance_Sheet_2026_08.xls",
        "1234_Spire Master Condominium Association_Budget_Export_OP.xlsx",
        "1234_Spire Master Condominium Association_Budget_Export_RSV.xlsx",
        "1234_Spire Master Condominium Association_Income_Statement_CY.xls",
        "1234_Spire Master Condominium Association_Income_Statement_PY.xls",
      ].sort()
    );
  });

  it("preserves macros and the written data inside the zipped .xlsm", async () => {
    const { blob } = await buildRealZip();
    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const xlsmEntry = await zip.file("2026_Spire Master Condominium Association_Budget.xlsm")!.async("uint8array");
    const rewb = XLSX.read(xlsmEntry, { type: "array", bookVBA: true });

    expect(rewb.vbaraw).toBeTruthy();
    // CYBalSheet!B1 <- BS[0][0], written by writeBudgetWorkbook in buildRealZip above.
    expect(rewb.Sheets["CYBalSheet"]["B1"]?.v).toBeTruthy();
  });

  it("keeps the non-.xlsm files byte-identical to the originals", async () => {
    const { blob } = await buildRealZip();
    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const zippedBalance = await zip
      .file("1234_Spire Master Condominium Association_Balance_Sheet_2026_08.xls")!
      .async("uint8array");
    const originalBalance = fs.readFileSync(path.join(FIXTURES, "balance.xls"));

    expect(Buffer.compare(Buffer.from(zippedBalance), originalBalance)).toBe(0);
  });
});
