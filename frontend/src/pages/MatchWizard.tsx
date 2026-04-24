import { useCallback, useReducer, useRef } from "react";
import { Link } from "react-router-dom";
import ColumnSelector from "../components/ColumnSelector";
import DropZone from "../components/DropZone";
import ProgressBar from "../components/ProgressBar";
import ResultsSummary from "../components/ResultsSummary";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "name" | "company";

interface FileInfo {
  fileId: string;
  filename: string;
  columns: string[];
  rowCount: number;
  preview: Record<string, string>[];
}

interface ProgressState {
  current: number;
  total: number;
  stage: string;
  message: string;
}

interface Stats {
  matches: number;
  total: number;
  avg_score: number;
  exact_matches: number;
  processing_time_sec: number;
}

type WizardStep = "upload_a" | "upload_b" | "configure" | "running" | "results" | "error";

interface WizardState {
  step: WizardStep;
  fileA: FileInfo | null;
  fileB: FileInfo | null;
  colA: string;
  colB: string;
  // company-mode extras
  colOrgA: string;
  colOrgB: string;
  colNameA: string;
  colNameB: string;
  useOrgMatch: boolean;
  threshold: number;
  jobId: string;
  progress: ProgressState;
  stats: Stats | null;
  error: string;
  uploadingA: boolean;
  uploadingB: boolean;
}

type Action =
  | { type: "SET_FILE_A"; file: FileInfo }
  | { type: "SET_FILE_B"; file: FileInfo }
  | { type: "SET_COL_A"; col: string }
  | { type: "SET_COL_B"; col: string }
  | { type: "SET_COL_ORG_A"; col: string }
  | { type: "SET_COL_ORG_B"; col: string }
  | { type: "SET_COL_NAME_A"; col: string }
  | { type: "SET_COL_NAME_B"; col: string }
  | { type: "SET_USE_ORG_MATCH"; v: boolean }
  | { type: "SET_THRESHOLD"; v: number }
  | { type: "GO_STEP"; step: WizardStep }
  | { type: "START_JOB"; jobId: string }
  | { type: "PROGRESS"; p: Partial<ProgressState> }
  | { type: "COMPLETE"; stats: Stats }
  | { type: "ERROR"; msg: string }
  | { type: "UPLOADING_A"; v: boolean }
  | { type: "UPLOADING_B"; v: boolean }
  | { type: "RESET" };

const initial: WizardState = {
  step: "upload_a",
  fileA: null,
  fileB: null,
  colA: "",
  colB: "",
  colOrgA: "",
  colOrgB: "",
  colNameA: "",
  colNameB: "",
  useOrgMatch: false,
  threshold: 85,
  jobId: "",
  progress: { current: 0, total: 0, stage: "waiting", message: "" },
  stats: null,
  error: "",
  uploadingA: false,
  uploadingB: false,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_FILE_A":
      return {
        ...state,
        fileA: action.file,
        colA: action.file.columns[0] ?? "",
        colNameA: action.file.columns[0] ?? "",
        step: "upload_b",
      };
    case "SET_FILE_B":
      return {
        ...state,
        fileB: action.file,
        colB: action.file.columns[0] ?? "",
        colNameB: action.file.columns[0] ?? "",
        step: "configure",
      };
    case "SET_COL_A":
      return { ...state, colA: action.col };
    case "SET_COL_B":
      return { ...state, colB: action.col };
    case "SET_COL_ORG_A":
      return { ...state, colOrgA: action.col };
    case "SET_COL_ORG_B":
      return { ...state, colOrgB: action.col };
    case "SET_COL_NAME_A":
      return { ...state, colNameA: action.col };
    case "SET_COL_NAME_B":
      return { ...state, colNameB: action.col };
    case "SET_USE_ORG_MATCH":
      return { ...state, useOrgMatch: action.v };
    case "SET_THRESHOLD":
      return { ...state, threshold: action.v };
    case "GO_STEP":
      return { ...state, step: action.step };
    case "START_JOB":
      return { ...state, step: "running", jobId: action.jobId };
    case "PROGRESS":
      return { ...state, progress: { ...state.progress, ...action.p } };
    case "COMPLETE":
      return { ...state, step: "results", stats: action.stats };
    case "ERROR":
      return { ...state, step: "error", error: action.msg };
    case "UPLOADING_A":
      return { ...state, uploadingA: action.v };
    case "UPLOADING_B":
      return { ...state, uploadingB: action.v };
    case "RESET":
      return { ...initial };
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<FileInfo> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail ?? "Upload failed");
  }
  const data = await res.json();
  return {
    fileId: data.file_id,
    filename: data.filename,
    columns: data.columns,
    rowCount: data.row_count,
    preview: data.preview,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: { id: WizardStep; label: string }[] = [
    { id: "upload_a", label: "File A" },
    { id: "upload_b", label: "File B" },
    { id: "configure", label: "Configure" },
    { id: "running", label: "Running" },
    { id: "results", label: "Results" },
  ];
  const order = ["upload_a", "upload_b", "configure", "running", "results"];
  const currentIdx = order.indexOf(step);

  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={[
              "w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-semibold",
              i < currentIdx
                ? "bg-accent text-bg"
                : i === currentIdx
                ? "bg-accent/20 text-accent border border-accent"
                : "bg-border text-text-secondary",
            ].join(" ")}
          >
            {i < currentIdx ? "✓" : i + 1}
          </div>
          <span
            className={`font-mono text-xs hidden sm:inline ${
              i === currentIdx ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < currentIdx ? "bg-accent" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function PreviewTable({ preview, columns }: { preview: Record<string, string>[]; columns: string[] }) {
  if (!preview.length) return null;
  const cols = columns.slice(0, 5);
  return (
    <div className="overflow-x-auto mt-4 rounded-lg border border-border">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="bg-surface border-b border-border">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-text-secondary truncate max-w-[120px]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5 text-text-primary truncate max-w-[120px]">
                  {row[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

interface Props {
  mode: Mode;
}

export default function MatchWizard({ mode }: Props) {
  const [state, dispatch] = useReducer(reducer, initial);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleFileA = useCallback(async (file: File) => {
    dispatch({ type: "UPLOADING_A", v: true });
    try {
      const info = await uploadFile(file);
      dispatch({ type: "SET_FILE_A", file: info });
    } catch (e: unknown) {
      dispatch({ type: "ERROR", msg: (e as Error).message });
    } finally {
      dispatch({ type: "UPLOADING_A", v: false });
    }
  }, []);

  const handleFileB = useCallback(async (file: File) => {
    dispatch({ type: "UPLOADING_B", v: true });
    try {
      const info = await uploadFile(file);
      dispatch({ type: "SET_FILE_B", file: info });
    } catch (e: unknown) {
      dispatch({ type: "ERROR", msg: (e as Error).message });
    } finally {
      dispatch({ type: "UPLOADING_B", v: false });
    }
  }, []);

  const startJob = useCallback(async () => {
    if (!state.fileA || !state.fileB) return;

    let endpoint = "";
    let body: Record<string, unknown> = {};

    if (mode === "name") {
      endpoint = "/api/match/start/name";
      body = {
        file_a_id: state.fileA.fileId,
        file_b_id: state.fileB.fileId,
        column_a: state.colA,
        column_b: state.colB,
        threshold: state.threshold,
        file_a_name: state.fileA.filename,
        file_b_name: state.fileB.filename,
      };
    } else {
      endpoint = "/api/match/start/company";
      body = {
        file_a_id: state.fileA.fileId,
        file_b_id: state.fileB.fileId,
        col_name_a: state.colNameA,
        col_name_b: state.colNameB,
        col_org_a: state.colOrgA,
        col_org_b: state.colOrgB,
        use_org_match: state.useOrgMatch,
        threshold: state.threshold,
        file_a_name: state.fileA.filename,
        file_b_name: state.fileB.filename,
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Start failed" }));
        throw new Error(err.detail ?? "Start failed");
      }
      const { job_id } = await res.json();
      dispatch({ type: "START_JOB", jobId: job_id });

      const es = new EventSource(`/api/match/${job_id}/progress`);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "progress") {
            dispatch({
              type: "PROGRESS",
              p: { current: event.current, total: event.total, stage: event.stage },
            });
          } else if (event.type === "stage") {
            dispatch({ type: "PROGRESS", p: { message: event.message } });
          } else if (event.type === "complete") {
            es.close();
            dispatch({ type: "COMPLETE", stats: event.stats });
          } else if (event.type === "error") {
            es.close();
            dispatch({ type: "ERROR", msg: event.message });
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        dispatch({ type: "ERROR", msg: "Connection to server lost." });
      };
    } catch (e: unknown) {
      dispatch({ type: "ERROR", msg: (e as Error).message });
    }
  }, [mode, state]);

  const handleReset = () => {
    eventSourceRef.current?.close();
    dispatch({ type: "RESET" });
  };

  const title = mode === "name" ? "Name Match" : "Company Match";

  return (
    <div className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-text-secondary font-mono text-sm hover:text-accent transition-colors">
          &larr; back
        </Link>
      </div>

      <h1 className="font-mono text-3xl font-semibold text-text-primary mb-2">{title}</h1>
      <p className="text-text-secondary font-mono text-sm mb-8">
        {mode === "name"
          ? "Match names across two files using TF-IDF + RapidFuzz scoring."
          : "Match companies by name or organisation number."}
      </p>

      {state.step !== "error" && <StepIndicator step={state.step} />}

      {/* ── Step: Upload A ── */}
      {state.step === "upload_a" && (
        <div>
          <h2 className="font-mono text-lg font-medium text-text-primary mb-4">Step 1 — Upload File A</h2>
          {state.uploadingA ? (
            <div className="text-accent font-mono text-sm animate-pulse">Uploading…</div>
          ) : (
            <DropZone onFile={handleFileA} label="The file you want to enrich" />
          )}
        </div>
      )}

      {/* ── Step: Upload B (with A column selector shown) ── */}
      {state.step === "upload_b" && state.fileA && (
        <div className="space-y-6">
          {/* File A info + column selector */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-sm text-accent font-medium">{state.fileA.filename}</span>
              <span className="font-mono text-xs text-text-secondary">
                {state.fileA.rowCount.toLocaleString()} rows
              </span>
            </div>

            {mode === "name" ? (
              <ColumnSelector
                label="Column to match on"
                columns={state.fileA.columns}
                value={state.colA}
                onChange={(v) => dispatch({ type: "SET_COL_A", col: v })}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ColumnSelector
                  label="Company name (required)"
                  columns={state.fileA.columns}
                  value={state.colNameA}
                  onChange={(v) => dispatch({ type: "SET_COL_NAME_A", col: v })}
                />
                <ColumnSelector
                  label="Org number"
                  columns={state.fileA.columns}
                  value={state.colOrgA}
                  onChange={(v) => dispatch({ type: "SET_COL_ORG_A", col: v })}
                  optional
                />
              </div>
            )}
            <PreviewTable preview={state.fileA.preview} columns={state.fileA.columns} />
          </div>

          <h2 className="font-mono text-lg font-medium text-text-primary">Step 2 — Upload File B</h2>
          {state.uploadingB ? (
            <div className="text-accent font-mono text-sm animate-pulse">Uploading…</div>
          ) : (
            <DropZone onFile={handleFileB} label="The reference file to match against" />
          )}
        </div>
      )}

      {/* ── Step: Configure ── */}
      {state.step === "configure" && state.fileA && state.fileB && (
        <div className="space-y-6">
          {/* File B info */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-sm text-accent font-medium">{state.fileB.filename}</span>
              <span className="font-mono text-xs text-text-secondary">
                {state.fileB.rowCount.toLocaleString()} rows
              </span>
            </div>

            {mode === "name" ? (
              <ColumnSelector
                label="Column to match on"
                columns={state.fileB.columns}
                value={state.colB}
                onChange={(v) => dispatch({ type: "SET_COL_B", col: v })}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ColumnSelector
                  label="Company name (required)"
                  columns={state.fileB.columns}
                  value={state.colNameB}
                  onChange={(v) => dispatch({ type: "SET_COL_NAME_B", col: v })}
                />
                <ColumnSelector
                  label="Org number"
                  columns={state.fileB.columns}
                  value={state.colOrgB}
                  onChange={(v) => dispatch({ type: "SET_COL_ORG_B", col: v })}
                  optional
                />
              </div>
            )}
            <PreviewTable preview={state.fileB.preview} columns={state.fileB.columns} />
          </div>

          {/* Org number toggle (company mode only) */}
          {mode === "company" && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <p className="font-mono text-sm text-text-primary mb-3">
                Do both files contain organisation numbers?
              </p>
              <div className="flex gap-3">
                {(["yes", "no"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => dispatch({ type: "SET_USE_ORG_MATCH", v: opt === "yes" })}
                    className={[
                      "px-5 py-2 rounded-lg font-mono text-sm border transition-colors",
                      (opt === "yes") === state.useOrgMatch
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-text-secondary hover:border-accent/60",
                    ].join(" ")}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Threshold */}
          {!(mode === "company" && state.useOrgMatch) && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <label className="font-mono text-sm text-text-primary mb-4 block">
                Match threshold:{" "}
                <span className="text-accent font-semibold">{state.threshold}%</span>
              </label>
              <input
                type="range"
                min={50}
                max={100}
                value={state.threshold}
                onChange={(e) => dispatch({ type: "SET_THRESHOLD", v: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between font-mono text-xs text-text-secondary mt-1">
                <span>50%</span>
                <span className="text-text-secondary/60">Only show matches above {state.threshold}%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          <button
            onClick={startJob}
            className="w-full bg-accent text-bg font-mono font-semibold py-3 rounded-xl
                       hover:bg-amber-400 active:bg-amber-600 transition-colors"
          >
            Run Match
          </button>
        </div>
      )}

      {/* ── Step: Running ── */}
      {state.step === "running" && (
        <div className="space-y-6">
          <h2 className="font-mono text-lg font-medium text-text-primary">Running…</h2>
          <div className="bg-surface border border-border rounded-xl p-6">
            <ProgressBar
              current={state.progress.current}
              total={state.progress.total}
              stage={state.progress.stage}
              message={state.progress.message}
            />
          </div>
          <button
            onClick={handleReset}
            className="text-text-secondary font-mono text-sm hover:text-danger transition-colors border border-border px-4 py-2 rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Step: Results ── */}
      {state.step === "results" && state.stats && (
        <ResultsSummary stats={state.stats} jobId={state.jobId} onReset={handleReset} />
      )}

      {/* ── Step: Error ── */}
      {state.step === "error" && (
        <div className="space-y-4">
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-5">
            <p className="font-mono text-sm text-red-400 font-medium mb-1">Error</p>
            <p className="font-mono text-sm text-text-primary">{state.error}</p>
          </div>
          <button
            onClick={handleReset}
            className="bg-surface border border-border text-text-primary font-mono text-sm px-5 py-2.5 rounded-lg hover:border-accent transition-colors"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
