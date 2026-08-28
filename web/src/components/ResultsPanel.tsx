// Ports the log + result blocks from src/templates/index.html. Kept
// minimal for phase 4 — the original's per-file src->dst rename table
// doesn't have a direct equivalent yet, since phase 5 (zipOutput.ts)
// hasn't defined what "output files" means for a zip download. Extend
// this once that's built.

export interface LogEntry {
  msg: string;
  level: "info" | "success" | "error" | "warn";
}

export interface RunResult {
  ok: boolean;
  title: string;
  detail: string;
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
        </div>
      )}
    </>
  );
}
