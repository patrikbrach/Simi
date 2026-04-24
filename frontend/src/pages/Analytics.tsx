import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AnalyticsData {
  total_runs: number;
  runs_last_30_days: number;
  use_case_distribution: Record<string, number>;
  score_trend: { day: string; avg_score: number }[];
  processing_time_by_bucket: Record<string, number>;
  threshold_distribution: { threshold: number; count: number }[];
}

const COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899"];

const UC_LABELS: Record<string, string> = {
  name_match: "Name Match",
  company_org: "Company (Org#)",
  company_name: "Company (Name)",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-text-secondary font-mono text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h3 className="font-mono text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#1a1d24",
  border: "1px solid #2a2d35",
  borderRadius: "8px",
  fontFamily: "IBM Plex Mono, monospace",
  fontSize: "12px",
  color: "#f0f0ef",
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Failed to load analytics."));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400 font-mono">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-secondary font-mono animate-pulse">Loading analytics…</p>
      </div>
    );
  }

  const useCasePieData = Object.entries(data.use_case_distribution).map(([k, v]) => ({
    name: UC_LABELS[k] ?? k,
    value: v,
  }));

  const procTimeData = Object.entries(data.processing_time_by_bucket).map(([k, v]) => ({
    bucket: k,
    avg_sec: v,
  }));

  return (
    <div className="min-h-screen px-4 py-12 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-text-secondary font-mono text-sm hover:text-accent transition-colors">
          &larr; home
        </Link>
      </div>

      <h1 className="font-mono text-3xl font-semibold text-text-primary mb-8">Analytics</h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total runs" value={data.total_runs.toLocaleString()} />
        <StatCard label="Last 30 days" value={data.runs_last_30_days.toLocaleString()} />
        {data.score_trend.length > 0 && (
          <StatCard
            label="Latest avg score"
            value={`${data.score_trend[data.score_trend.length - 1]?.avg_score ?? "—"}%`}
          />
        )}
        {data.threshold_distribution.length > 0 && (
          <StatCard
            label="Most common threshold"
            value={`${data.threshold_distribution.sort((a, b) => b.count - a.count)[0]?.threshold ?? "—"}%`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Use case distribution */}
        <ChartCard title="Use Case Distribution">
          {useCasePieData.length === 0 ? (
            <p className="text-text-secondary font-mono text-sm">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={useCasePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  labelLine={false}
                >
                  {useCasePieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Threshold distribution */}
        <ChartCard title="Threshold Distribution">
          {data.threshold_distribution.length === 0 ? (
            <p className="text-text-secondary font-mono text-sm">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.threshold_distribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d35" />
                <XAxis dataKey="threshold" tick={{ fill: "#8a8d96", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                <YAxis tick={{ fill: "#8a8d96", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Score trend */}
      <div className="mb-6">
        <ChartCard title="Average Match Score Over Time">
          {data.score_trend.length === 0 ? (
            <p className="text-text-secondary font-mono text-sm">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.score_trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d35" />
                <XAxis dataKey="day" tick={{ fill: "#8a8d96", fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#8a8d96", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="avg_score"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Avg Score"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Processing time by bucket */}
      <ChartCard title="Avg Processing Time by File A Row Count">
        {procTimeData.length === 0 ? (
          <p className="text-text-secondary font-mono text-sm">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={procTimeData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d35" />
              <XAxis dataKey="bucket" tick={{ fill: "#8a8d96", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <YAxis tick={{ fill: "#8a8d96", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}s`, "Avg time"]} />
              <Legend
                wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: "#8a8d96" }}
              />
              <Bar dataKey="avg_sec" fill="#22c55e" radius={[3, 3, 0, 0]} name="Avg seconds" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
