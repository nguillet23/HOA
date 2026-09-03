// Mirrors src/handlers_associations.py — parses an uploaded
// Association Export.xlsx and persists its raw parsed rows + upload
// metadata in IndexedDB so the list survives reloads/browser restarts
// without a server. See "Associations list" section in
// LIVE_WEBSITE_PLAN.md: this file has one confirmed maintainer
// (2026-09-03), so per-device IndexedDB storage with no cross-device sync
// is an accepted trade-off, not an open question blocking this.

import * as XLSX from "xlsx";

const DB_NAME = "budget-processor";
const DB_VERSION = 1;
const STORE_NAME = "associations";
const RECORD_ID = "current";

export interface Association {
  value: string;
  label: string;
  num: string;
}

export interface AssociationsRecord {
  id: typeof RECORD_ID;
  filename: string;
  uploadedAt: number;
  rows: Association[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mirrors handlers_associations.py's row -> {value,label,num} mapping:
 * column 0 is the association Code, column 2 is used for both value and
 * label. In the real export file column 2 is actually "Nickname" (column
 * order: Code, Association Name, Nickname, ...) — the Python source's own
 * inline comment calling it "Association" is misleading, but this mirrors
 * its actual indexing (row[0]/row[2]), which is what the live app does
 * today. Row 0 is the header row.
 */
export function parseAssociationsWorkbook(wb: XLSX.WorkBook): Association[] {
  const sheetName = wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) {
    throw new Error("Associations file: no sheet found");
  }

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  const associations: Association[] = [];
  for (const row of rows.slice(1)) {
    const num = row[0];
    const name = row[2];
    if (name === null || name === undefined || name === "") continue;
    associations.push({
      value: String(name),
      label: String(name),
      num: num === null || num === undefined ? "" : String(num),
    });
  }

  if (associations.length === 0) {
    throw new Error("Associations file: no association rows found");
  }

  return associations;
}

export async function saveAssociationsFile(file: File): Promise<AssociationsRecord> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const rows = parseAssociationsWorkbook(wb);

  const record: AssociationsRecord = {
    id: RECORD_ID,
    filename: file.name,
    uploadedAt: Date.now(),
    rows,
  };

  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }

  return record;
}

export async function loadAssociationsRecord(): Promise<AssociationsRecord | null> {
  try {
    const db = await openDb();
    try {
      return await new Promise<AssociationsRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(RECORD_ID);
        req.onsuccess = () => resolve((req.result as AssociationsRecord | undefined) ?? null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // IndexedDB unavailable (private browsing, disabled) or corrupt record —
    // the list just starts empty and the picker prompts an upload; same
    // "best effort" posture as useMemory.ts.
    return null;
  }
}
