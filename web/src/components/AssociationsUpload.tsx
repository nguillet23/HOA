// The "Update Associations List" picker + "last updated" indicator — see
// "Associations list" section in LIVE_WEBSITE_PLAN.md. Deliberately
// separate from the 6 processing FileSlots: this file is maintained on its
// own cadence (only when the association roster changes) and its parsed
// contents persist in IndexedDB across sessions, not re-selected every run.

import { useRef } from "react";

interface AssociationsUploadProps {
  filename: string | null;
  uploadedAt: number | null;
  count: number;
  error: string | null;
  onUpload: (file: File) => void;
}

export default function AssociationsUpload({
  filename,
  uploadedAt,
  count,
  error,
  onUpload,
}: AssociationsUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const statusText = filename
    ? `Associations list: ${filename}, updated ${new Date(uploadedAt!).toLocaleDateString()} (${count} association${count === 1 ? "" : "s"})`
    : "No associations list loaded yet — upload one to populate the dropdown above";

  return (
    <div className="assoc-upload">
      <div className="assoc-upload-text">
        <span className={`assoc-upload-status${filename ? "" : " placeholder"}`}>{statusText}</span>
        {error && <span className="assoc-upload-error">✗ {error}</span>}
      </div>
      <button type="button" className="file-pick-btn" onClick={() => inputRef.current?.click()}>
        {filename ? "Update List" : "Upload List"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
