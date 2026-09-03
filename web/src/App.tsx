// Top-level layout, mirrors src/templates/index.html. Wires phases 2-5
// (read/parse, write, zip + download) to the real UI end to end.

import { useState } from "react";
import UploadForm from "./components/UploadForm";
import ResultsPanel, { type LogEntry, type RunResult } from "./components/ResultsPanel";
import AccessGate from "./components/AccessGate";
import AssociationsUpload from "./components/AssociationsUpload";
import { readWorkbookFromFile, parseAllSheets } from "./lib/readSheets";
import { writeBudgetWorkbook } from "./lib/writeWorkbook";
import { buildOutputZip, triggerDownload } from "./lib/zipOutput";
import type { FormValues } from "./lib/validate";
import { useAssociations } from "./hooks/useAssociations";
import "./App.css";

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const associationsState = useAssociations();

  function log(msg: string, level: LogEntry["level"] = "info") {
    setLogs((prev) => [...prev, { msg, level }]);
  }

  async function handleSubmit(values: FormValues) {
    setLogs([]);
    setResult(null);
    setSubmitting(true);

    try {
      log(
        `Association: ${values.association} (#${values.number})  |  Period: ${values.year}_${values.month}  |  Budget Year: ${values.budgetYear}`
      );

      // validateForm (called before onSubmit fires) already guarantees
      // every FILE_KEYS slot has a File, so the non-null assertions below
      // are safe.
      log("Reading source files…");
      const [balanceWb, opWb, rsvWb, cyWb, pyWb, targetWb] = await Promise.all([
        readWorkbookFromFile(values.files.balance!),
        readWorkbookFromFile(values.files.operating!),
        readWorkbookFromFile(values.files.reserve!),
        readWorkbookFromFile(values.files.cy!),
        readWorkbookFromFile(values.files.py!),
        readWorkbookFromFile(values.files.target!),
      ]);

      log("Parsing Balance Sheet, Operating/Reserve Budgets, CY/PY Income Statements…");
      const parsed = parseAllSheets({
        balance: balanceWb,
        operating: opWb,
        reserve: rsvWb,
        cy: cyWb,
        py: pyWb,
      });

      log("Writing to macro workbook…");
      writeBudgetWorkbook(targetWb, parsed, values.password);
      log("Workbook updated and protected.", "success");

      log("Packaging output files into a zip…");
      const { blob, zipFilename, outputFiles } = await buildOutputZip({
        targetWorkbook: targetWb,
        targetFileName: values.files.target!.name,
        sourceFiles: {
          balance: values.files.balance!,
          operating: values.files.operating!,
          reserve: values.files.reserve!,
          cy: values.files.cy!,
          py: values.files.py!,
        },
        association: values.association,
        number: values.number,
        month: values.month,
        year: values.year,
        budgetYear: values.budgetYear,
      });

      triggerDownload(blob, zipFilename);
      log(`Downloaded ${zipFilename}`, "success");

      setResult({
        ok: true,
        title: "✓ Processing Complete",
        detail: `Downloaded as ${zipFilename}`,
        outputFiles,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(message, "error");
      setResult({ ok: false, title: "✗ Processing Failed", detail: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AccessGate>
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 4 A9 9 0 0 1 22 13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M4 13 A9 9 0 0 1 13 4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <rect x="9" y="11" width="8" height="11" rx="1" fill="white" />
              <polygon points="13,5 7,12 19,12" fill="rgba(255,255,255,0.85)" />
              <rect x="11.5" y="17" width="3" height="5" rx="0.5" fill="#3a9bbf" />
            </svg>
          </div>
          <div className="topbar-name">
            <span className="line1">HomeOwners</span>
            <span className="line2">Advantage</span>
          </div>
        </div>
        <div className="topbar-divider"></div>
        <div className="topbar-right">Budget Processing Tool</div>
      </div>

      <div className="page">
        <div className="page-header">
          <div className="page-header-left">
            <h1>
              Monthly <span>Budget</span> Processor
            </h1>
            <div className="tagline">
              Select source files — everything happens in your browser, nothing is uploaded anywhere
            </div>
          </div>
          <div className="step-pill">2 Steps to Complete</div>
        </div>

        <UploadForm associations={associationsState.associations} submitting={submitting} onSubmit={handleSubmit} />

        <ResultsPanel logs={logs} result={result} onClearLog={() => setLogs([])} />

        <AssociationsUpload
          filename={associationsState.filename}
          uploadedAt={associationsState.uploadedAt}
          count={associationsState.associations.length}
          error={associationsState.error}
          onUpload={associationsState.upload}
        />

        <div className="page-footer">
          <div className="footer-logo">
            <svg viewBox="0 0 16 16">
              <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 1.8l5 2.8-5 2.8-5-2.8 5-2.8zM2 6.6l5 2.8v5.1L2 11.7V6.6zm6 7.9V9.4l5-2.8v5.1L8 14.5z" />
            </svg>
          </div>
          <div className="footer-text">
            HomeOwners <span>Advantage</span> &nbsp;·&nbsp; Budget Processing Tool
          </div>
        </div>
      </div>
    </AccessGate>
  );
}

export default App;
