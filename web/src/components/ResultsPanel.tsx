// Ports the log + result blocks from src/templates/index.html. The
// per-file src->dst list now mirrors the zip contents (phase 5,
// zipOutput.ts) instead of the original's dest_folder rename table — same
// `.result-files`/`.rf` markup and CSS, just sourced from `OutputFileEntry`
// instead of a server response.

import type { OutputFileEntry } from "../lib/zipOutput";

export interface LogEntry {
  msg: string;
  level: "info" | "success" | "error" | "warn";
}

export interface RunResult {
  ok: boolean;
  title: string;
  detail: string;
  outputFiles?: OutputFileEntry[];
}

interface ResultsPanelProps {
  logs: LogEntry[];
  result: RunResult | null;
  onClearLog: () => void;
}

export default function ResultsPanel({ logs, result, onClearLog }: ResultsPanelProps) {
  return (
    <>
      {logs.length > 0 && (
        <div className="log-wrap show">
          <div className="log-header">
            <span className="log-title">Process Log</span>
            <button type="button" className="log-clear" onClick={onClearLog}>
              Clear
            </button>
          </div>
          <div className="log-body">
            {logs.map((l, i) => (
              <div key={i} className={`ll ${l.level}`}>
                <span className="m">{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className={`result-block show${result.ok ? "" : " fail"}`}>
          <div className="result-title">{result.title}</div>
          <div className="result-folder">{result.detail}</div>
          {result.outputFiles && result.outputFiles.length > 0 && (
            <div className="result-files">
              {result.outputFiles.map((f) => (
                <div key={f.dst} className="rf">
                  <span>{f.src}</span>
                  <span className="arrow">→</span>
                  <span className="dst">{f.dst}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
