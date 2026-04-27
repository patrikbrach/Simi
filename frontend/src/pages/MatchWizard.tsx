import { useCallback, useReducer, useRef } from "react";
import { Link } from "react-router-dom";
import ColumnSelector from "../components/ColumnSelector";
import DropZone from "../components/DropZone";
import ProgressBar from "../components/ProgressBar";
import ResultsSummary from "../components/ResultsSummary";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "name" | "city" | "id";

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
  // name mode
  colA: string;
  colB: string;
  // city mode
  colNameA: string;
  colNameB: string;
  colCityA: string;
  colCityB: string;
  // id mode
  colIdA: string;
  colIdB: string;
  colLabelB: string;
  // shared
  threshold: number;
  jobId: string;
  progress: ProgressState;
  stats: Stats | null;
  error: string;
  extraColsB: string[];
  uploadingA: boolean;
  uploadingB: boolean;
}

type Action =
  | { type: "SET_FILE_A"; file: FileInfo }
  | { type: "SET_FILE_B"; file: FileInfo }
  | { type: "SET_COL_A"; col: string }
  | { type: "SET_COL_B"; col: string }
  | { type: "SET_COL_NAME_A"; col: string }
  | { type: "SET_COL_NAME_B"; col: string }
  | { type: "SET_COL_CITY_A"; col: string }
  | { type: "SET_COL_CITY_B"; col: string }
  | { type: "SET_COL_ID_A"; col: string }
  | { type: "SET_COL_ID_B"; col: string }
  | { type: "SET_COL_LABEL_B"; col: string }
  | { type: "TOGGLE_EXTRA_COL_B"; col: string }
  | { type: "SET_THRESHOLD"; v: number }
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
  colNameA: "",
  colNameB: "",
  colCityA: "",
  colCityB: "",
  colIdA: "",
  colIdB: "",
  colLabelB: "",
  extraColsB: [],
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
        colCityA: action.file.columns[1] ?? action.file.columns[0] ?? "",
        colIdA: action.file.columns[0] ?? "",
        step: "upload_b",
      };
    case "SET_FILE_B":
      return {
        ...state,
        fileB: action.file,
        colB: action.file.columns[0] ?? "",
        colNameB: action.file.columns[0] ?? "",
        colCityB: action.file.columns[1] ?? action.file.columns[0] ?? "",
        colIdB: action.file.columns[0] ?? "",
        colLabelB: action.file.columns[0] ?? "",
        step: "configure",
      };
    case "SET_COL_A":         return { ...state, colA: action.col };
    case "SET_COL_B":         return { ...state, colB: action.col };
    case "SET_COL_NAME_A":    return { ...state, colNameA: action.col };
    case "SET_COL_NAME_B":    return { ...state, colNameB: action.col };
    case "SET_COL_CITY_A":    return { ...state, colCityA: action.col };
    case "SET_COL_CITY_B":    return { ...state, colCityB: action.col };
    case "SET_COL_ID_A":      return { ...state, colIdA: action.col };
    case "SET_COL_ID_B":      return { ...state, colIdB: action.col };
    case "SET_COL_LABEL_B":   return { ...state, colLabelB: action.col };
    case "TOGGLE_EXTRA_COL_B": {
      const already = state.extraColsB.includes(action.col);
      return {
        ...state,
        extraColsB: already
          ? state.extraColsB.filter((c) => c !== action.col)
          : [...state.extraColsB, action.col],
      };
    }
    case "SET_THRESHOLD":     return { ...state, threshold: action.v };
    case "START_JOB":         return { ...state, step: "running", jobId: action.jobId };
    case "PROGRESS":          return { ...state, progress: { ...state.progress, ...action.p } };
    case "COMPLETE":          return { ...state, step: "results", stats: action.stats };
    case "ERROR":             return { ...state, step: "error", error: action.msg };
    case "UPLOADING_A":       return { ...state, uploadingA: action.v };
    case "UPLOADING_B":       return { ...state, uploadingB: action.v };
    case "RESET":             return { ...initial };
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

// ── Mode metadata ─────────────────────────────────────────────────────────────

const MODE_META = {
  name: {
    title: "Name Match",
    desc: "Fuzzy match on a single name column using TF-IDF + RapidFuzz.",
    endpoint: "/api/match/start/name",
  },
  city: {
    title: "Name + City Match",
    desc: "Fuzzy name match boosted by city (75% name · 25% city).",
    endpoint: "/api/match/start/city",
  },
  id: {
    title: "ID Match",
    desc: "Exact match on an identifier column — org numbers, ISRCs, customer IDs, etc.",
    endpoint: "/api/match/start/id",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: WizardStep }) {
  const steps = ["upload_a", "upload_b", "configure", "running", "results"];
  const labels = ["File A", "File B", "Configure", "Running", "Results"];
  const currentIdx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-10">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
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
          <span className={`font-mono text-xs hidden sm:inline ${i === currentIdx ? "text-text-primary" : "text-text-secondary"}`}>
            {labels[i]}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < currentIdx ? "bg-accent" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FileCard({
  info,
  children,
}: {
  info: FileInfo;
  children: React.ReactNode;
}) {
  const cols = info.columns.slice(0, 5);
  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <span className="font-mono text-sm text-accent font-medium truncate max-w-[70%]">
          {info.filename}
        </span>
        <span className="font-mono text-xs text-text-secondary">
          {info.rowCount.toLocaleString()} rows
        </span>
      </div>

      {children}

      {/* Preview table */}
      {info.preview.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-surface border-b border-border">
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 text-left text-text-secondary truncate max-w-[120px]">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {info.preview.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-1.5 text-text-primary truncate max-w-[120px]">{row[c] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function MatchWizard({ mode }: { mode: Mode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const eventSourceRef = useRef<EventSource | null>(null);
  const meta = MODE_META[mode];

  const handleFileA = useCallback(async (file: File) => {
    dispatch({ type: "UPLOADING_A", v: true });
    try {
      dispatch({ type: "SET_FILE_A", file: await uploadFile(file) });
    } catch (e: unknown) {
      dispatch({ type: "ERROR", msg: (e as Error).message });
    } finally {
      dispatch({ type: "UPLOADING_A", v: false });
    }
  }, []);

  const handleFileB = useCallback(async (file: File) => {
    dispatch({ type: "UPLOADING_B", v: true });
    try {
      dispatch({ type: "SET_FILE_B", file: await uploadFile(file) });
    } catch (e: unknown) {
      dispatch({ type: "ERROR", msg: (e as Error).message });
    } finally {
      dispatch({ type: "UPLOADING_B", v: false });
    }
  }, []);

  const startJob = useCallback(async () => {
    if (!state.fileA || !state.fileB) return;

    let body: Record<string, unknown> = {
      file_a_name: state.fileA.filename,
      file_b_name: state.fileB.filename,
    };

    if (mode === "name") {
      body = {
        ...body,
        file_a_id: state.fileA.fileId,
        file_b_id: state.fileB.fileId,
        column_a: state.colA,
        column_b: state.colB,
        threshold: state.threshold,
        extra_cols_b: state.extraColsB,
      };
    } else if (mode === "city") {
      body = {
        ...body,
        file_a_id: state.fileA.fileId,
        file_b_id: state.fileB.fileId,
        col_name_a: state.colNameA,
        col_name_b: state.colNameB,
        col_city_a: state.colCityA,
        col_city_b: state.colCityB,
        threshold: state.threshold,
        extra_cols_b: state.extraColsB,
      };
    } else {
      body = {
        ...body,
        file_a_id: state.fileA.fileId,
        file_b_id: state.fileB.fileId,
        col_id_a: state.colIdA,
        col_id_b: state.colIdB,
        col_label_b: state.colLabelB,
        extra_cols_b: state.extraColsB,
      };
    }

    try {
      const res = await fetch(meta.endpoint, {
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
            dispatch({ type: "PROGRESS", p: { current: event.current, total: event.total, stage: event.stage } });
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
  }, [mode, meta.endpoint, state]);

  const handleReset = () => {
    eventSourceRef.current?.close();
    dispatch({ type: "RESET" });
  };

  // ── Column selectors per mode ──────────────────────────────────────────────

  function ColsFileA(columns: string[]) {
    if (mode === "name") {
      return (
        <ColumnSelector label="Column to match on" columns={columns} value={state.colA}
          onChange={(v) => dispatch({ type: "SET_COL_A", col: v })} />
      );
    }
    if (mode === "city") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <ColumnSelector label="Name column" columns={columns} value={state.colNameA}
            onChange={(v) => dispatch({ type: "SET_COL_NAME_A", col: v })} />
          <ColumnSelector label="City column" columns={columns} value={state.colCityA}
            onChange={(v) => dispatch({ type: "SET_COL_CITY_A", col: v })} />
        </div>
      );
    }
    return (
      <ColumnSelector label="ID column" columns={columns} value={state.colIdA}
        onChange={(v) => dispatch({ type: "SET_COL_ID_A", col: v })} />
    );
  }

  function ColsFileB(columns: string[]) {
    if (mode === "name") {
      return (
        <ColumnSelector label="Column to match on" columns={columns} value={state.colB}
          onChange={(v) => dispatch({ type: "SET_COL_B", col: v })} />
      );
    }
    if (mode === "city") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <ColumnSelector label="Name column" columns={columns} value={state.colNameB}
            onChange={(v) => dispatch({ type: "SET_COL_NAME_B", col: v })} />
          <ColumnSelector label="City column" columns={columns} value={state.colCityB}
            onChange={(v) => dispatch({ type: "SET_COL_CITY_B", col: v })} />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-3">
        <ColumnSelector label="ID column" columns={columns} value={state.colIdB}
          onChange={(v) => dispatch({ type: "SET_COL_ID_B", col: v })} />
        <ColumnSelector label="Label column (pulled into result)" columns={columns} value={state.colLabelB}
          onChange={(v) => dispatch({ type: "SET_COL_LABEL_B", col: v })} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-text-secondary font-mono text-sm hover:text-accent transition-colors">
          &larr; back
        </Link>
      </div>

      <h1 className="font-mono text-3xl font-semibold text-text-primary mb-2">{meta.title}</h1>
      <p className="text-text-secondary font-mono text-sm mb-8">{meta.desc}</p>

      {state.step !== "error" && <StepIndicator step={state.step} />}

      {/* Upload A */}
      {state.step === "upload_a" && (
        <div>
          <h2 className="font-mono text-lg font-medium text-text-primary mb-4">Step 1 — Upload File A</h2>
          {state.uploadingA
            ? <div className="text-accent font-mono text-sm animate-pulse">Uploading…</div>
            : <DropZone onFile={handleFileA} label="The file you want to enrich" />}
        </div>
      )}

      {/* Upload B — shows File A card with column selectors + File B drop zone */}
      {state.step === "upload_b" && state.fileA && (
        <div className="space-y-6">
          <FileCard info={state.fileA}>{ColsFileA(state.fileA.columns)}</FileCard>
          <h2 className="font-mono text-lg font-medium text-text-primary">Step 2 — Upload File B</h2>
          {state.uploadingB
            ? <div className="text-accent font-mono text-sm animate-pulse">Uploading…</div>
            : <DropZone onFile={handleFileB} label="The reference file to match against" />}
        </div>
      )}

      {/* Configure — shows File B card with column selectors + threshold + run */}
      {state.step === "configure" && state.fileA && state.fileB && (
        <div className="space-y-6">
          <FileCard info={state.fileB}>{ColsFileB(state.fileB.columns)}</FileCard>

          {/* Extra columns from File B */}
          {(() => {
            const usedCols = new Set(
              mode === "name" ? [state.colB]
              : mode === "city" ? [state.colNameB, state.colCityB]
              : [state.colIdB, state.colLabelB]
            );
            const available = state.fileB!.columns.filter((c) => !usedCols.has(c));
            if (available.length === 0) return null;
            return (
              <div className="bg-surface border border-border rounded-xl p-5">
                <p className="font-mono text-sm text-text-primary mb-3">
                  Also include from File B <span className="text-text-secondary">(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {available.map((col) => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={state.extraColsB.includes(col)}
                        onChange={() => dispatch({ type: "TOGGLE_EXTRA_COL_B", col })}
                        className="accent-amber-500 w-4 h-4"
                      />
                      <span className="font-mono text-xs text-text-secondary group-hover:text-text-primary transition-colors truncate">
                        {col}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          {mode !== "id" && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <label className="font-mono text-sm text-text-primary mb-4 block">
                Match threshold: <span className="text-accent font-semibold">{state.threshold}%</span>
              </label>
              <input
                type="range" min={50} max={100} value={state.threshold}
                onChange={(e) => dispatch({ type: "SET_THRESHOLD", v: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between font-mono text-xs text-text-secondary mt-1">
                <span>50%</span>
                <span className="text-text-secondary/60">Only highlight matches above {state.threshold}%</span>
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

      {/* Running */}
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
            className="text-text-secondary font-mono text-sm hover:text-red-400 transition-colors border border-border px-4 py-2 rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Results */}
      {state.step === "results" && state.stats && (
        <ResultsSummary stats={state.stats} jobId={state.jobId} onReset={handleReset} />
      )}

      {/* Error */}
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
