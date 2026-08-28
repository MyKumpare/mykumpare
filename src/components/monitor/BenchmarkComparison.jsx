import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Loader2, AlertCircle, BarChart2, Target, Users } from "lucide-react";

const MONTHS_BACK = 12;

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

/** Last N month keys (YYYY-MM) + display labels, ending at the current month. */
function lastNMonths(n) {
  const keys = [];
  const labels = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`);
    labels.push(MONTH_FMT.format(ref));
  }
  return { keys, labels };
}

function dateToMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Weighted final score for a ScoringMatrixScore record (block-weighted avg of final_score). */
function weightedFinal(score) {
  const blocks = score.scoring_blocks || [];
  let totalW = 0;
  let sum = 0;
  blocks.forEach((b) => {
    const w = b.weight || 0;
    const scored = (b.criteria || []).filter((c) => c.final_score != null);
    if (!scored.length) return;
    const avg = scored.reduce((s, c) => s + c.final_score, 0) / scored.length;
    sum += avg * w;
    totalW += w;
  });
  if (totalW === 0) return null;
  return Math.round((sum / totalW) * 100) / 100;
}

const getFirmTypes = (f) => (f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : []);

const METRICS = [
  { key: "score", label: "Score Trend", unit: "score", domain: [0, 5], step: 0.1, placeholder: "e.g. 3.5" },
  { key: "aum", label: "AUM Growth", unit: "$", domain: null, step: 1000000, placeholder: "e.g. 500000000" },
  { key: "returns", label: "Returns", unit: "%", domain: null, step: 0.1, placeholder: "monthly %" },
];

export default function BenchmarkComparison({ onFirmClick }) {
  const [firmId, setFirmId] = useState("");
  const [metric, setMetric] = useState("score");
  const [source, setSource] = useState("peer"); // "peer" | "target"
  const [benchmarkId, setBenchmarkId] = useState("");
  const [targetValue, setTargetValue] = useState("");

  const { keys: monthKeys, labels: monthLabels } = useMemo(() => lastNMonths(MONTHS_BACK), []);
  const keyToLabel = useMemo(() => {
    const m = {};
    monthKeys.forEach((k, i) => (m[k] = monthLabels[i]));
    return m;
  }, [monthKeys, monthLabels]);

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    select: (d) => (d || []).filter((f) => !f.deleted_at),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date", 5000),
    select: (d) => (d || []).filter((p) => !p.deleted_at),
  });

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date", 500),
  });

  const { data: scores = [], isLoading: scoresLoading } = useQuery({
    queryKey: ["benchmark-comparison-scores"],
    queryFn: () => base44.entities.ScoringMatrixScore.list("-scoring_end_date", 1000),
    select: (d) => (d || []).filter((s) => s.status === "finalized" && (s.scoring_end_date || s.scoring_start_date)),
  });

  const { data: returnSeries = [], isLoading: returnsLoading } = useQuery({
    queryKey: ["benchmark-comparison-returns"],
    queryFn: () => base44.entities.ReturnSeries.list("-created_date", 1000),
  });

  const selectedFirm = firms.find((f) => f.id === firmId);

  // Peer firms = share at least one firm type with the selected firm
  const peerFirmIds = useMemo(() => {
    if (!selectedFirm) return new Set();
    const types = new Set(getFirmTypes(selectedFirm));
    if (!types.size) return new Set();
    return new Set(
      firms.filter((f) => f.id !== firmId && getFirmTypes(f).some((t) => types.has(t))).map((f) => f.id)
    );
  }, [firms, selectedFirm, firmId]);

  const metricCfg = METRICS.find((m) => m.key === metric);

  // ── Build chart data for the selected metric ──
  const chartData = useMemo(() => {
    if (!firmId) return [];
    const rows = monthKeys.map((k) => ({ month: keyToLabel[k], Firm: null, Overlay: null }));

    if (metric === "score") {
      // Firm line: latest weighted final score per month
      const firmByMonth = {};
      scores.filter((s) => s.firm_id === firmId).forEach((s) => {
        const k = dateToMonthKey(s.scoring_end_date || s.scoring_start_date);
        if (!k || !keyToLabel[k]) return;
        const v = weightedFinal(s);
        if (v == null) return;
        if (firmByMonth[k] == null) firmByMonth[k] = v; // sorted desc, first is latest
      });
      // Peer line: average weighted final across peer firms per month
      const peerByMonth = {};
      scores.filter((s) => peerFirmIds.has(s.firm_id)).forEach((s) => {
        const k = dateToMonthKey(s.scoring_end_date || s.scoring_start_date);
        if (!k || !keyToLabel[k]) return;
        const v = weightedFinal(s);
        if (v == null) return;
        if (!peerByMonth[k]) peerByMonth[k] = { sum: 0, count: 0 };
        peerByMonth[k].sum += v;
        peerByMonth[k].count += 1;
      });
      const tv = source === "target" && targetValue !== "" ? Number(targetValue) : null;
      monthKeys.forEach((k, i) => {
        rows[i].Firm = firmByMonth[k] ?? null;
        if (source === "peer") {
          const p = peerByMonth[k];
          rows[i].Overlay = p && p.count ? Math.round((p.sum / p.count) * 100) / 100 : null;
        } else if (tv != null && !isNaN(tv)) {
          rows[i].Overlay = tv;
        }
      });
    } else if (metric === "aum") {
      const firmAum = {};
      (selectedFirm?.aum_history || []).forEach((e) => {
        const k = dateToMonthKey(e.month_end_date);
        if (!k || !keyToLabel[k]) return;
        firmAum[k] = e.firm_aum ?? null;
      });
      const peerAum = {};
      firms.filter((f) => peerFirmIds.has(f.id)).forEach((f) => {
        (f.aum_history || []).forEach((e) => {
          const k = dateToMonthKey(e.month_end_date);
          if (!k || !keyToLabel[k]) return;
          if (!peerAum[k]) peerAum[k] = { sum: 0, count: 0 };
          if (e.firm_aum != null) {
            peerAum[k].sum += e.firm_aum;
            peerAum[k].count += 1;
          }
        });
      });
      const tv = source === "target" && targetValue !== "" ? Number(targetValue) : null;
      monthKeys.forEach((k, i) => {
        rows[i].Firm = firmAum[k] ?? null;
        if (source === "peer") {
          const p = peerAum[k];
          rows[i].Overlay = p && p.count ? Math.round(p.sum / p.count) : null;
        } else if (tv != null && !isNaN(tv)) {
          rows[i].Overlay = tv;
        }
      });
    } else if (metric === "returns") {
      const firmProductIds = new Set(products.filter((p) => p.firm_id === firmId).map((p) => p.id));
      const peerProductIds = new Set(products.filter((p) => peerFirmIds.has(p.firm_id)).map((p) => p.id));
      const firmByMonth = {};
      const peerByMonth = {};
      returnSeries.forEach((rs) => {
        (rs.monthly_returns || []).forEach((mr) => {
          const k = dateToMonthKey(mr.date);
          if (!k || !keyToLabel[k]) return;
          const v = mr.return_value;
          if (v == null) return;
          if (firmProductIds.has(rs.product_id)) {
            if (!firmByMonth[k]) firmByMonth[k] = { sum: 0, count: 0 };
            firmByMonth[k].sum += v;
            firmByMonth[k].count += 1;
          } else if (peerProductIds.has(rs.product_id)) {
            if (!peerByMonth[k]) peerByMonth[k] = { sum: 0, count: 0 };
            peerByMonth[k].sum += v;
            peerByMonth[k].count += 1;
          }
        });
      });
      const benchmark = benchmarks.find((b) => b.id === benchmarkId);
      const benchByMonth = {};
      (benchmark?.monthly_returns || []).forEach((mr) => {
        const k = dateToMonthKey(mr.date);
        if (!k || !keyToLabel[k]) return;
        benchByMonth[k] = mr.return_value;
      });
      monthKeys.forEach((k, i) => {
        const f = firmByMonth[k];
        rows[i].Firm = f && f.count ? Math.round((f.sum / f.count) * 100) / 100 : null;
        if (source === "peer") {
          const p = peerByMonth[k];
          rows[i].Overlay = p && p.count ? Math.round((p.sum / p.count) * 100) / 100 : null;
        } else {
          rows[i].Overlay = benchByMonth[k] ?? null;
        }
      });
    }
    return rows;
  }, [firmId, metric, source, targetValue, benchmarkId, scores, firms, products, returnSeries, benchmarks, peerFirmIds, monthKeys, keyToLabel, selectedFirm]);

  const overlayLabel = useMemo(() => {
    if (source === "peer") return `Peer avg (${peerFirmIds.size} firms)`;
    if (metric === "returns") {
      const b = benchmarks.find((bb) => bb.id === benchmarkId);
      return b ? `Benchmark: ${b.name}` : "Benchmark";
    }
    return "Target";
  }, [source, metric, peerFirmIds, benchmarkId, benchmarks]);

  const fmtValue = (v) => {
    if (v == null) return "—";
    if (metric === "aum") return `$${Math.round(v).toLocaleString()}`;
    if (metric === "returns") return `${v}%`;
    return v;
  };

  const loading = firmsLoading || scoresLoading || returnsLoading;
  const hasFirmData = chartData.some((r) => r.Firm != null);
  const hasOverlay = chartData.some((r) => r.Overlay != null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-rose-600" />
        <h3 className="text-base font-semibold text-gray-800">Benchmark Comparison</h3>
        <span className="text-xs text-gray-500">(last {MONTHS_BACK} months)</span>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Firm</label>
            <select
              value={firmId}
              onChange={(e) => setFirmId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Select a firm…</option>
              {firms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Overlay source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="peer">Industry avg (peers)</option>
              <option value="target">{metric === "returns" ? "Benchmark record" : "Custom target"}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {source === "peer" ? "Peer group" : metric === "returns" ? "Benchmark" : "Target value"}
            </label>
            {source === "peer" ? (
              <div className="h-9 flex items-center gap-1.5 text-sm text-gray-600">
                <Users className="w-4 h-4 text-gray-400" />
                {selectedFirm ? `${peerFirmIds.size} peer firm${peerFirmIds.size === 1 ? "" : "s"} (same type)` : "—"}
              </div>
            ) : metric === "returns" ? (
              <select
                value={benchmarkId}
                onChange={(e) => setBenchmarkId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Select benchmark…</option>
                {benchmarks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <Target className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={metricCfg.placeholder}
                  step={metricCfg.step}
                  className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-2 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : !firmId ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Select a firm to compare its performance against an industry average or custom target.
        </div>
      ) : !hasFirmData && !hasOverlay ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          No {metricCfg.label.toLowerCase()} data found for this firm in the last {MONTHS_BACK} months.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis
                    domain={metricCfg.domain || ["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(v) => (metric === "aum" && v != null ? `${(v / 1e9).toFixed(1)}B` : metric === "returns" ? `${v}%` : v)}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                    formatter={(value, name) => (value == null ? ["—", name] : [fmtValue(value), name])}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="Firm"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                    name={selectedFirm?.name || "Firm"}
                  />
                  <Line
                    type="monotone"
                    dataKey="Overlay"
                    stroke="#e11d48"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                    name={overlayLabel}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Firm latest" value={fmtValue([...chartData].reverse().find((r) => r.Firm != null)?.Firm)} />
            <StatCard label="Overlay latest" value={fmtValue([...chartData].reverse().find((r) => r.Overlay != null)?.Overlay)} />
            <StatCard
              label="Difference"
              value={(() => {
                const f = [...chartData].reverse().find((r) => r.Firm != null)?.Firm;
                const o = [...chartData].reverse().find((r) => r.Overlay != null)?.Overlay;
                if (f == null || o == null) return "—";
                const d = Math.round((f - o) * 100) / 100;
                return `${d > 0 ? "+" : ""}${fmtValue(d)}`;
              })()}
              accent
            />
            <StatCard label="Peer sample" value={source === "peer" ? `${peerFirmIds.size} firms` : "—"} />
          </div>

          {selectedFirm && onFirmClick && (
            <button
              onClick={() => onFirmClick(selectedFirm.id)}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium"
            >
              Open {selectedFirm.name} record →
            </button>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent ? "text-rose-600" : "text-gray-900"}`}>{value ?? "—"}</p>
    </div>
  );
}