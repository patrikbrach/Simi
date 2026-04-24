interface Stats {
  matches: number;
  total: number;
  avg_score: number;
  exact_matches: number;
  processing_time_sec: number;
}

interface Props {
  stats: Stats;
  jobId: string;
  onReset: () => void;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-text-secondary font-mono text-xs uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="font-mono text-xl font-semibold text-text-primary">{value}</div>
    </div>
  );
}

export default function ResultsSummary({ stats, jobId, onReset }: Props) {
  const pct =
    stats.total > 0
      ? Math.round((stats.matches / stats.total) * 100)
      : 0;

  const handleDownload = () => {
    window.location.href = `/api/match/${jobId}/download`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="font-mono text-2xl font-semibold text-text-primary mb-6">
        Match complete
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <Stat label="Total rows" value={stats.total.toLocaleString()} />
        <Stat label="Matches found" value={`${stats.matches.toLocaleString()} (${pct}%)`} />
        <Stat label="Avg score" value={`${stats.avg_score}%`} />
        <Stat label="Exact matches" value={stats.exact_matches.toLocaleString()} />
        <Stat label="Processing time" value={`${stats.processing_time_sec}s`} />
      </div>

      <button
        onClick={handleDownload}
        className="w-full bg-accent text-bg font-mono font-semibold py-3 rounded-xl
                   hover:bg-amber-400 active:bg-amber-600 transition-colors mb-3"
      >
        Download Result Excel
      </button>

      <button
        onClick={onReset}
        className="w-full bg-transparent border border-border text-text-secondary font-mono py-2.5 rounded-xl
                   hover:border-accent hover:text-text-primary transition-colors text-sm"
      >
        Start New Match
      </button>
    </div>
  );
}
