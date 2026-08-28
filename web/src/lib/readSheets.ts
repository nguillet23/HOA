// Mirrors the 5 read+transform steps in handlers_process.py (lines 58-114):
// Balance Sheet, Operating Budget, Reserve Budget, and the CY/PY Income
// Statement reads + "Operating Net Total " split. Phase 2 of
// LIVE_WEBSITE_PLAN.md. The actual write-window slicing (`.iloc[0:501,
// 2:21]` etc. in the Python `sheet_operations` list) is phase 3
// (writeWorkbook.ts), not here — this module only produces the 7 parsed
// matrices those slices are taken from.

import * as XLSX from "xlsx";
import { COLS_TO_DROP, OPERATING_NET_TOTAL_LABEL } from "./constants";

export type CellValue = string | number | boolean | Date | null;
export type Matrix = CellValue[][];

export interface ParsedSheets {
  BS: Matrix;
  OP: Matrix;
  RSV: Matrix;
  OP_CY: Matrix;
  RSV_CY: Matrix;
  OP_PY: Matrix;
  RSV_PY: Matrix;
}

function sheetToMatrix(ws: XLSX.WorkSheet): Matrix {
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as Matrix;
}

function requireSheet(wb: XLSX.WorkBook, sheetName: string, fileLabel: string): XLSX.WorkSheet {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`${fileLabel}: sheet "${sheetName}" not found`);
  }
  return ws;
}

function dropColumn(matrix: Matrix, colIndex: number): Matrix {
  return matrix.map((row) => row.filter((_, i) => i !== colIndex));
}

function dropColumns(matrix: Matrix, colIndexes: number[]): Matrix {
  const drop = new Set(colIndexes);
  return matrix.map((row) => row.filter((_, i) => !drop.has(i)));
}

function findOperatingNetTotalRow(matrix: Matrix): number {
  return matrix.findIndex((row) => row[0] === OPERATING_NET_TOTAL_LABEL);
}

/** Mirrors: pd.read_excel(paths["balance"], sheet_name="BalanceSheet", ...) */
export function parseBalanceSheet(wb: XLSX.WorkBook): Matrix {
  return sheetToMatrix(requireSheet(wb, "BalanceSheet", "Balance Sheet"));
}

/** Mirrors: pd.read_excel(paths["operating"], sheet_name="Sheet1", ...).drop(columns=6) */
export function parseOperatingBudget(wb: XLSX.WorkBook): Matrix {
  const matrix = sheetToMatrix(requireSheet(wb, "Sheet1", "Operating Budget Export"));
  return dropColumn(matrix, 6);
}

/** Mirrors: pd.read_excel(paths["reserve"], sheet_name="Sheet1", ...).drop(columns=6) */
export function parseReserveBudget(wb: XLSX.WorkBook): Matrix {
  const matrix = sheetToMatrix(requireSheet(wb, "Sheet1", "Reserve Budget Export"));
  return dropColumn(matrix, 6);
}

export interface IncomeStatementSplit {
  operating: Matrix;
  reserve: Matrix;
}

/**
 * Mirrors the CY/PY block (handlers_process.py:87-98 and :103-114):
 * read "Income Statement", drop COLS_TO_DROP, find the row where column 0
 * is "Operating Net Total ", then split into an "operating" half (rows
 * 0..row inclusive) and a "reserve" half (rows row..500, exclusive-clipped
 * to sheet length same as pandas .iloc does).
 */
export function parseAndSplitIncomeStatement(wb: XLSX.WorkBook, fileLabel: string): IncomeStatementSplit {
  const raw = sheetToMatrix(requireSheet(wb, "Income Statement", fileLabel));
  const dropped = dropColumns(raw, COLS_TO_DROP);

  const rowIdx = findOperatingNetTotalRow(dropped);
  if (rowIdx === -1) {
    throw new Error(`${fileLabel}: could not find 'Operating Net Total' row.`);
  }

  return {
    operating: dropped.slice(0, rowIdx + 1),
    reserve: dropped.slice(rowIdx, 500),
  };
}

export interface SourceWorkbooks {
  balance: XLSX.WorkBook;
  operating: XLSX.WorkBook;
  reserve: XLSX.WorkBook;
  cy: XLSX.WorkBook;
  py: XLSX.WorkBook;
}

/** Runs all 5 read+transform steps, mirroring handlers_process.py end to end. */
export function parseAllSheets(workbooks: SourceWorkbooks): ParsedSheets {
  const BS = parseBalanceSheet(workbooks.balance);
  const OP = parseOperatingBudget(workbooks.operating);
  const RSV = parseReserveBudget(workbooks.reserve);
  const cySplit = parseAndSplitIncomeStatement(workbooks.cy, "Current Year Income Statement");
  const pySplit = parseAndSplitIncomeStatement(workbooks.py, "Prior Year Income Statement");

  return {
    BS,
    OP,
    RSV,
    OP_CY: cySplit.operating,
    RSV_CY: cySplit.reserve,
    OP_PY: pySplit.operating,
    RSV_PY: pySplit.reserve,
  };
}

/** Browser-side helper: read a File into a SheetJS workbook (bookVBA:true so this doubles for the .xlsm target file too, once phase 3 needs it). */
export async function readWorkbookFromFile(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array", bookVBA: true, cellStyles: true });
}
