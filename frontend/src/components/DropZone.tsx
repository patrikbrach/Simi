import { useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  label?: string;
  disabled?: boolean;
}

export default function DropZone({ onFile, label = "Drop file here", disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFile(file);
      e.target.value = "";
    }
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={[
        "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors duration-150 select-none",
        dragging ? "border-accent bg-amber-500/5" : "border-border hover:border-accent/60",
        disabled ? "opacity-40 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <div className="text-text-secondary font-mono text-sm">
        <span className="text-accent font-medium">Click to browse</span> or drag &amp; drop
      </div>
      <div className="text-text-secondary text-xs mt-2 font-mono">{label}</div>
      <div className="text-text-secondary text-xs mt-1 font-mono opacity-60">.xlsx · .xls · .csv</div>
    </div>
  );
}
