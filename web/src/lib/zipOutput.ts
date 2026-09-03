// Mirrors the shutil.copy2 (target workbook) + shutil.move (5 source
// files) block in handlers_process.py (lines 116-217): bundles the written
// .xlsm + the renamed originals into a single .zip and triggers a browser
// download. There's no local folder to write into from a static page —
// see the mapping table in LIVE_WEBSITE_PLAN.md.
//
// One difference from the Python version worth naming: shutil.move
// actually removes the originals from their source location, renaming
// them in place. There's no equivalent "remove" here — the File objects
// the browser handed us are just read into the zip under a new name; the
// user's original files on disk are untouched (a static page has no
// permission to delete anything from their filesystem anyway).

import JSZip from "jszip";
import * as XLSX from "xlsx";

export interface OutputFileEntry {
  src: string;
  dst: string;
}

export interface BuildZipParams {
  targetWorkbook: XLSX.WorkBook; // already written + protected (writeWorkbook.ts)
  targetFileName: string; // original target File's name, for the output_files record only
  sourceFiles: {
    balance: File;
    operating: File;
    reserve: File;
    cy: File;
    py: File;
  };
  association: string;
  number: string;
  month: string;
  year: string;
  budgetYear: string;
}

export interface BuildZipResult {
  blob: Blob;
  zipFilename: string;
  outputFiles: OutputFileEntry[];
}

export async function buildOutputZip(params: BuildZipParams): Promise<BuildZipResult> {
  const { targetWorkbook, targetFileName, sourceFiles, association, number, month, year, budgetYear } = params;
  const date = `${year}_${month}`;

  const targetDstName = `${budgetYear}_${association}_Budget.xlsm`;
  const moveMap: { key: keyof BuildZipParams["sourceFiles"]; dst: string }[] = [
    { key: "balance", dst: `${number}_${association}_Balance_Sheet_${date}.xls` },
    { key: "operating", dst: `${number}_${association}_Budget_Export_OP.xlsx` },
    { key: "reserve", dst: `${number}_${association}_Budget_Export_RSV.xlsx` },
    { key: "cy", dst: `${number}_${association}_Income_Statement_CY.xls` },
    { key: "py", dst: `${number}_${association}_Income_Statement_PY.xls` },
  ];

  const zip = new JSZip();

  const targetBuffer = XLSX.write(targetWorkbook, { type: "array", bookType: "xlsm", bookVBA: true });
  zip.file(targetDstName, targetBuffer);

  const outputFiles: OutputFileEntry[] = [{ src: targetFileName, dst: targetDstName }];

  for (const { key, dst } of moveMap) {
    const file = sourceFiles[key];
    const buffer = await file.arrayBuffer();
    zip.file(dst, buffer);
    outputFiles.push({ src: file.name, dst });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const zipFilename = `${number}_${association}_${date}_Budget_Output.zip`;

  return { blob, zipFilename, outputFiles };
}

/** Triggers a browser download of `blob` as `filename` — no server round-trip. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
