// Mirrors src/utils.py — kept as a single source of truth for the file-slot
// config and the two hard-coded transform constants (COLS_TO_DROP, the
// "Operating Net Total " row label) shared by readSheets.ts (phase 2) and
// writeWorkbook.ts (phase 3).

export type FileKey = "balance" | "operating" | "reserve" | "cy" | "py" | "target";

export const FILE_LABELS: Record<FileKey, string> = {
  balance: "Balance Sheet",
  operating: "Operating Budget Export",
  reserve: "Reserve Budget Export",
  cy: "Current Year Income Statement",
  py: "Prior Year Income Statement",
  target: "Budget Macro Workbook",
};

export const FILE_KEYS = Object.keys(FILE_LABELS) as FileKey[];

export const VALID_MONTHS = new Set(
  Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
);

export const FILE_EXTENSIONS: Record<FileKey, string[]> = {
  target: [".xlsm"],
  balance: [".xls", ".xlsx"],
  operating: [".xls", ".xlsx"],
  reserve: [".xls", ".xlsx"],
  cy: [".xls", ".xlsx"],
  py: [".xls", ".xlsx"],
};

// Positional column indices dropped from the CY/PY Income Statement sheets
// before locating the "Operating Net Total " row. Order-sensitive: mirrors
// `CY.drop(CY.columns[COLS_TO_DROP], axis=1)` in handlers_process.py, which
// resolves against the sheet's original 0-based column positions (no prior
// drop has happened to CY/PY at that point), so this must stay a list of
// original-sheet column positions, not re-indexed after each removal.
export const COLS_TO_DROP = [3, 4, 6, 7, 10, 12, 13, 15, 16, 18, 19, 22, 24, 25, 28, 29];

// The row label the CY/PY split pivots on (note the trailing space — exact
// match, mirrors `CY[0] == "Operating Net Total "` in handlers_process.py).
export const OPERATING_NET_TOTAL_LABEL = "Operating Net Total ";

// The 9 sheet/cell write targets in the macro workbook, in write order.
// `matrix` names the ParsedSheets key (see readSheets.ts) each operation
// reads from, and `window` is the [rowStart, rowEnd, colStart, colEnd]
// slice applied before writing — mirrors the `sheet_operations` list in
// handlers_process.py. Consumed by writeWorkbook.ts (phase 3); defined here
// now since it's static data with no SheetJS dependency.
export interface SheetWriteTarget {
  sheet: string;
  cell: string;
  matrix: "BS" | "OP" | "RSV" | "OP_CY" | "RSV_CY" | "OP_PY" | "RSV_PY";
  window?: { rows: [number, number]; cols: [number, number] };
}

export const SHEET_WRITE_TARGETS: SheetWriteTarget[] = [
  { sheet: "CYBalSheet", cell: "B1", matrix: "BS" },
  { sheet: "CYBudOP", cell: "B2", matrix: "OP", window: { rows: [0, 501], cols: [2, 21] } },
  { sheet: "CYBudRSV", cell: "B2", matrix: "RSV", window: { rows: [0, 501], cols: [2, 21] } },
  { sheet: "CYActOP", cell: "C1", matrix: "OP_CY", window: { rows: [0, 501], cols: [0, 15] } },
  { sheet: "CYActRSV", cell: "C5", matrix: "RSV_CY", window: { rows: [0, 501], cols: [0, 15] } },
  { sheet: "PYActOP", cell: "C1", matrix: "OP_PY", window: { rows: [0, 501], cols: [0, 15] } },
  { sheet: "PYActRSV", cell: "C5", matrix: "RSV_PY", window: { rows: [0, 501], cols: [0, 15] } },
  { sheet: "CYActRSV", cell: "C1", matrix: "OP_CY", window: { rows: [0, 5], cols: [0, 15] } },
  { sheet: "PYActRSV", cell: "C1", matrix: "OP_PY", window: { rows: [0, 5], cols: [0, 15] } },
];
