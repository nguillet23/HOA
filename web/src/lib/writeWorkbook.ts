// Mirrors the write block in handlers_process.py (lines 116-179): write the
// 9 sheet/cell targets into the macro workbook, then set sheet protection.
// Phase 3 of LIVE_WEBSITE_PLAN.md.
//
// One behavioral simplification versus the Python/xlwings version: xlwings
// unprotects -> writes -> re-protects around *each* of the 9 operations
// (some sheets get hit more than once). SheetJS has no live "protection"
// state to toggle while editing in memory — `!protect` is just a flag
// written once at save time — so this writes all 9 targets first, then
// sets protection once per sheet touched, before the caller hands the
// workbook to XLSX.writeFile. Functionally equivalent, fewer moving parts.

import * as XLSX from "xlsx";
import { SHEET_WRITE_TARGETS } from "./constants";
import type { ParsedSheets, Matrix } from "./readSheets";

function sliceWindow(
  matrix: Matrix,
  window?: { rows: [number, number]; cols: [number, number] }
): Matrix {
  if (!window) return matrix;
  const [rowStart, rowEnd] = window.rows;
  const [colStart, colEnd] = window.cols;
  return matrix.slice(rowStart, rowEnd).map((row) => row.slice(colStart, colEnd));
}

function requireSheet(wb: XLSX.WorkBook, sheetName: string): XLSX.WorkSheet {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`Sheet '${sheetName}' not found in the Budget Macro Workbook.`);
  }
  return ws;
}

/**
 * Writes the 9 sheet/cell targets into `wb` (mutated in place) using the
 * matrices from `parsed`, then protects every sheet touched with
 * `password`. Returns `wb` for convenience. Does not write to disk or
 * trigger a download — that's phase 5 (zipOutput.ts).
 */
export function writeBudgetWorkbook(
  wb: XLSX.WorkBook,
  parsed: ParsedSheets,
  password: string
): XLSX.WorkBook {
  const touchedSheets = new Set<string>();

  for (const target of SHEET_WRITE_TARGETS) {
    const ws = requireSheet(wb, target.sheet);
    const data = sliceWindow(parsed[target.matrix], target.window);
    XLSX.utils.sheet_add_aoa(ws, data, { origin: target.cell });
    touchedSheets.add(target.sheet);
  }

  for (const sheetName of touchedSheets) {
    wb.Sheets[sheetName]["!protect"] = { password };
  }

  return wb;
}
