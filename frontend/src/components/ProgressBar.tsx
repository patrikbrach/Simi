interface Props {
  current: number;
  total: number;
  stage: string;
  message?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default function ProgressBar({ current, total, stage, message }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="w-full">
      {message && (
        <p className="font-mono text-sm text-text-secondary mb-3 animate-pulse">{message}</p>
      )}

      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between mt-2">
        <span className="font-mono text-xs text-text-secondary">{stage}</span>
        {total > 0 && (
          <span className="font-mono text-xs text-text-secondary">
            {fmt(current)} / {fmt(total)}
          </span>
        )}
        <span className="font-mono text-xs text-accent font-medium">{pct}%</span>
      </div>
    </div>
  );
}
