// Ports the "Association Details" + "Source Documents" cards from
// src/templates/index.html + the validation/restore-session logic from
// src/static/script.js. Two things from the original intentionally don't
// appear here: the Backup Folder field (no local filesystem write access
// from a static page — replaced by a zip download in phase 5) and the Stop
// App button (there's no server to shut down).

import { useState } from "react";
import { FILE_EXTENSIONS, FILE_KEYS, FILE_LABELS, type FileKey } from "../lib/constants";
import { validateForm, type FormValues, type ValidationError } from "../lib/validate";
import { useMemory } from "../hooks/useMemory";
import FileSlot from "./FileSlot";

const MONTH_NAMES: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May", "06": "June", "07": "July", "08": "August",
  "09": "September", "10": "October", "11": "November", "12": "December",
};

const FILE_TILE_META: Record<FileKey, { icon: string; description: string; wide?: boolean }> = {
  target: { icon: "📁", description: "Master .xlsm template — data will be written here", wide: true },
  balance: { icon: "📊", description: ".xls or .xlsx export" },
  operating: { icon: "📋", description: ".xls or .xlsx export" },
  reserve: { icon: "🏦", description: ".xls or .xlsx export" },
  cy: { icon: "📈", description: ".xls or .xlsx export" },
  py: { icon: "📉", description: ".xls or .xlsx export" },
};

export interface Association {
  value: string;
  label: string;
  num: string;
}

interface UploadFormProps {
  associations: Association[];
  submitting: boolean;
  onSubmit: (values: FormValues) => void;
}

export default function UploadForm({ associations, submitting, onSubmit }: UploadFormProps) {
  const { remembered, save } = useMemory();
  const hasRemembered =
    !!remembered.lastAssociation || !!remembered.lastMonth || !!remembered.lastYear || !!remembered.lastBudgetYear;

  const [association, setAssociation] = useState("");
  const [number, setNumber] = useState("");
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [budgetYear, setBudgetYear] = useState(() => String(new Date().getFullYear()));
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<Partial<Record<FileKey, File | null>>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showRestore, setShowRestore] = useState(hasRemembered);

  function errorFor(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function clearError(field: string) {
    setErrors((prev) => prev.filter((e) => e.field !== field));
  }

  function restoreSession() {
    if (remembered.lastAssociation) {
      setAssociation(remembered.lastAssociation);
      setNumber(remembered.lastNumber);
    }
    if (remembered.lastMonth) setMonth(remembered.lastMonth);
    if (remembered.lastYear) setYear(remembered.lastYear);
    if (remembered.lastBudgetYear) setBudgetYear(remembered.lastBudgetYear);
    setShowRestore(false);
  }

  function handleFileSelect(key: FileKey, file: File | null) {
    setFiles((prev) => ({ ...prev, [key]: file }));
    clearError(`file_${key}`);
  }

  function handleAssocChange(value: string) {
    setAssociation(value);
    const found = associations.find((a) => a.value === value);
    setNumber(found?.num ?? "");
    clearError("association");
  }

  function handleRun() {
    const values: FormValues = { association, number, month, year, budgetYear, password, files };
    const validationErrors = validateForm(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    save({
      lastAssociation: association,
      lastNumber: number,
      lastMonth: month,
      lastYear: year,
      lastBudgetYear: budgetYear,
    });

    onSubmit(values);
  }

  const restoreDetailParts: string[] = [];
  if (remembered.lastAssociation) restoreDetailParts.push(`${remembered.lastAssociation} (#${remembered.lastNumber})`);
  if (remembered.lastMonth && remembered.lastYear) {
    restoreDetailParts.push(`period ${MONTH_NAMES[remembered.lastMonth] ?? remembered.lastMonth} ${remembered.lastYear}`);
  }
  if (remembered.lastBudgetYear) restoreDetailParts.push(`budget year ${remembered.lastBudgetYear}`);

  return (
    <>
      {showRestore && (
        <div className="restore-banner show">
          <div className="restore-banner-icon">🕐</div>
          <div className="restore-banner-text">
            <div className="restore-banner-title">Restore Last Session?</div>
            <div className="restore-banner-detail">
              Last session: {restoreDetailParts.join(" · ")}. Restore these values?
            </div>
          </div>
          <div className="restore-actions">
            <button type="button" className="restore-btn restore-btn-yes" onClick={restoreSession}>
              Restore
            </button>
            <button type="button" className="restore-btn restore-btn-no" onClick={() => setShowRestore(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="steps-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-step-num">1</div>
            <div className="card-header-title">Association Details</div>
            <div className="card-header-sub">Required for file naming</div>
          </div>
          <div className="card-body">
            <div className="field-grid">
              <div className={`field full${errorFor("association") ? " field-error" : ""}`}>
                <label>
                  Association Name <span className="req">*</span>
                </label>
                <select value={association} onChange={(e) => handleAssocChange(e.target.value)}>
                  <option value="" disabled>
                    {associations.length ? "Select association…" : "No associations loaded — upload the list below"}
                  </option>
                  {associations.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {errorFor("association") && <span className="field-error-msg">{errorFor("association")}</span>}
              </div>

              <div className={`field${errorFor("month") ? " field-error" : ""}`}>
                <label>
                  Month <span className="req">*</span>
                </label>
                <select
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    clearError("month");
                  }}
                >
                  <option value="" disabled>
                    Select month
                  </option>
                  {Object.entries(MONTH_NAMES).map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
                {errorFor("month") && <span className="field-error-msg">{errorFor("month")}</span>}
              </div>

              <div className={`field${errorFor("year") ? " field-error" : ""}`}>
                <label>
                  Year <span className="req">*</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 2025"
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    clearError("year");
                  }}
                />
                {errorFor("year") && <span className="field-error-msg">{errorFor("year")}</span>}
              </div>

              <div className={`field${errorFor("budgetYear") ? " field-error" : ""}`}>
                <label>
                  Budget Year <span className="req">*</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 2025"
                  value={budgetYear}
                  onChange={(e) => {
                    setBudgetYear(e.target.value);
                    clearError("budgetYear");
                  }}
                />
                {errorFor("budgetYear") && <span className="field-error-msg">{errorFor("budgetYear")}</span>}
              </div>

              <div className={`field${errorFor("password") ? " field-error" : ""}`}>
                <label>
                  Workbook Password <span className="req">*</span>
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="Enter workbook password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError("password");
                  }}
                />
                {errorFor("password") && <span className="field-error-msg">{errorFor("password")}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-step-num">2</div>
            <div className="card-header-title">Source Documents</div>
            <div className="card-header-sub">Click Browse on each tile</div>
          </div>
          <div className="card-body">
            <div className="files-grid">
              {FILE_KEYS.map((key) => (
                <FileSlot
                  key={key}
                  fileKey={key}
                  label={FILE_LABELS[key]}
                  description={FILE_TILE_META[key].description}
                  icon={FILE_TILE_META[key].icon}
                  accept={FILE_EXTENSIONS[key].join(",")}
                  extHint={`Required · ${FILE_EXTENSIONS[key].join(" / ")}`}
                  file={files[key] ?? null}
                  error={errorFor(`file_${key}`)}
                  onSelect={(f) => handleFileSelect(key, f)}
                  wide={FILE_TILE_META[key].wide}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="run-card">
        {errors.length > 0 && (
          <div className="validation-banner show">
            <div className="validation-banner-header">
              <span className="validation-banner-title">Please fix the following before processing:</span>
            </div>
            <ul className="validation-error-list">
              {errors.map((e) => (
                <li key={e.field}>
                  <strong>{e.message}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="run-btn" disabled={submitting} onClick={handleRun}>
          {submitting ? "Processing…" : "Run Budget Processor"}
        </button>
        <div className="run-note">Complete all fields and select all files before processing</div>
      </div>
    </>
  );
}
