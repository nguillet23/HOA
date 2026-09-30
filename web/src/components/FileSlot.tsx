// One of the 6 file-input slots (target/balance/operating/reserve/cy/py).
// Replaces the native OS file-picker tile from src/templates/index.html —
// `<input type="file">` is the only file-selection mechanism a static page
// has; the browser never reveals the selected file's on-disk path.

import { useRef } from "react";
import type { FileKey } from "../lib/constants";

interface FileSlotProps {
  fileKey: FileKey;
  label: string;
  description: string;
  icon: string;
  accept: string;
  extHint: string;
  file: File | null;
  error?: string;
  onSelect: (file: File | null) => void;
  wide?: boolean;
}

export default function FileSlot({
  fileKey,
  label,
  description,
  icon,
  accept,
  extHint,
  file,
  error,
  onSelect,
  wide,
}: FileSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const classes = ["file-tile"];
  if (wide) classes.push("macro-tile");
  if (error) classes.push("file-error");
  else if (file) classes.push("done");

  return (
    <div id={`tile-${fileKey}`} className={classes.join(" ")}>
      <div className="file-tile-top">
        <div className="file-icon-wrap">{icon}</div>
        <div className="file-labels">
          <div className="file-title">{label}</div>
          <div className="file-desc">{description}</div>
        </div>
      </div>
      <div className="file-path-row">
        <span className={`file-path-text${file ? "" : " placeholder"}`}>
          {file ? file.name : "No file selected"}
        </span>
        <button type="button" className="file-pick-btn" onClick={() => inputRef.current?.click()}>
          Browse
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="file-status">{error ? `✗ ${error}` : file ? `✓ ${file.name}` : extHint}</div>
    </div>
  );
}
