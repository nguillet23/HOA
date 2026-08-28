// Mirrors validate_request in src/utils.py, adapted for the browser:
// - Files replace OS paths, so there's no isfile/exists check — a selected
//   File object always "exists" by definition.
// - No backup_folder check — no local filesystem write access from a
//   static page (see "Out of scope" / mapping table in
//   LIVE_WEBSITE_PLAN.md); output becomes a zip download instead (phase 5).

import { FILE_EXTENSIONS, FILE_KEYS, FILE_LABELS, VALID_MONTHS, type FileKey } from "./constants";

export interface FormValues {
  association: string;
  number: string;
  month: string;
  year: string;
  budgetYear: string;
  password: string;
  files: Partial<Record<FileKey, File | null>>;
}

export interface ValidationError {
  field: string;
  message: string;
}

function isFourDigitYearInRange(value: string): boolean {
  return /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;
}

export function validateForm(values: FormValues): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!values.association.trim()) {
    errors.push({ field: "association", message: "Association Name is missing" });
  }

  if (!values.month) {
    errors.push({ field: "month", message: "Month is missing" });
  } else if (!VALID_MONTHS.has(values.month)) {
    errors.push({ field: "month", message: `Month '${values.month}' is not valid — expected 01–12` });
  }

  if (!isFourDigitYearInRange(values.year.trim())) {
    errors.push({ field: "year", message: "Year is missing or invalid (4-digit, 2000–2100)" });
  }

  if (!isFourDigitYearInRange(values.budgetYear.trim())) {
    errors.push({ field: "budgetYear", message: "Budget Year is missing or invalid (4-digit, 2000–2100)" });
  }

  if (!values.password) {
    errors.push({ field: "password", message: "Workbook Password is missing" });
  }

  for (const key of FILE_KEYS) {
    const file = values.files[key];
    if (!file) {
      errors.push({ field: `file_${key}`, message: `${FILE_LABELS[key]} — no file selected` });
      continue;
    }
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    const allowed = FILE_EXTENSIONS[key];
    if (!allowed.includes(ext)) {
      errors.push({
        field: `file_${key}`,
        message: `${FILE_LABELS[key]} — wrong file type '${ext}' (expected ${allowed.join(" or ")})`,
      });
    }
  }

  return errors;
}
