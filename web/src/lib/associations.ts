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

// Header names in the Vantaca export that the dropdown is built from.
// Located by name rather than position so an added/removed/reordered
// column in a future export can't silently shift the wrong data into the
// dropdown. Matched case-insensitively with whitespace trimmed.
const CODE_HEADER = "Code";
const NAME_HEADER = "Nickname";

function normalizeHeader(cell: unknown): string {
  return cell === null || cell === undefined ? "" : String(cell).trim().toLowerCase();
}

/**
 * Same {value,label,num} output as handlers_associations.py: "Code" becomes
 * num, "Nickname" becomes both value and label. The Python version reads
 * these by position (row[0]/row[2]); this finds them by header name in row 0
 * instead, and throws a labeled error if either is missing.
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

  const headers = (rows[0] ?? []).map(normalizeHeader);
  const codeCol = headers.indexOf(normalizeHeader(CODE_HEADER));
  const nameCol = headers.indexOf(normalizeHeader(NAME_HEADER));
  const missing = [
    codeCol === -1 ? CODE_HEADER : null,
    nameCol === -1 ? NAME_HEADER : null,
  ].filter((h): h is string => h !== null);
  if (missing.length > 0) {
    const found = (rows[0] ?? [])
      .map((h) => (h === null || h === undefined ? "" : String(h).trim()))
      .filter((h) => h !== "");
    throw new Error(
      `Associations file is missing ${missing.map((h) => `a '${h}'`).join(" and ")} column` +
        ` — found: ${found.length > 0 ? found.join(", ") : "(no headers)"}`,
    );
  }

  const associations: Association[] = [];
  for (const row of rows.slice(1)) {
    const num = row[codeCol];
    const name = row[nameCol];
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
