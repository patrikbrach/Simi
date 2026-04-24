interface Props {
  label: string;
  columns: string[];
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}

export default function ColumnSelector({ label, columns, value, onChange, optional }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-text-secondary font-mono text-xs uppercase tracking-wider">
        {label}
        {optional && <span className="ml-1 text-text-secondary/50">(optional)</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-text-primary font-mono text-sm
                   focus:outline-none focus:border-accent transition-colors"
      >
        {optional && <option value="">— not mapped —</option>}
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
