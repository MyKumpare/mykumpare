import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Activity, Loader2 } from "lucide-react";

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

/**
 * Executive Dashboard section: compare a firm's product returns against a market
 * benchmark using interactive line charts. The firm list is derived from portfolio
 * allocations, so the section updates automatically whenever portfolio data changes.
 */
export default function FirmBenchmarkComparison({ firms = [], products = [], portfolios = [] }) {
  const [firmId, setFirmId] = useState("");
  const [benchmarkId, setBenchmarkId] = useState("");
  const [viewMode, setViewMode] = useState("monthly"); // "monthly" | "cumulative"

  const { keys: monthKeys, labels: monthLabels } = useMemo(() => lastNMonths(MONTHS_BACK), []);
  const keyToLabel = useMemo(() => {
    const m = {};
    monthKeys.forEach((k, i) => (m[k] = monthLabels[i]));
    return m;
  }, [monthKeys, monthLabels]);

  // Firms that appear as advisor in any portfolio — updates when portfolios change
  const portfolioFirmIds = useMemo(() => {
    const ids = new Set();
    for (const p of portfolios) {
      if (p.advisor_firm_id) ids.add(p.advisor_firm_id);
    }
    return ids;
  }, [portfolios]);

  const availableFirms = useMemo(
    () => firms.filter((f) => !f.deleted_at && portfolioFirmIds.has(f.id)),
    [firms, portfolioFirmIds]
  );

  // Auto-select first available firm when portfolio data loads/changes
  useEffect(() => {
    if (!firmId && availableFirms.length > 0) {
      setFirmId(availableFirms[0].id);
    }
    // If the selected firm is no longer in portfolios, reset
    if (firmId && !portfolioFirmIds.has(firmId) && availableFirms.length > 0) {
      setFirmId(availableFirms[0].id);
    }
  }, [availableFirms, firmId, portfolioFirmIds]);

  // Fetch benchmarks and return series (shared cache with rest of app)
  const { data: benchmarks = [], isLoading: benchmarksLoading } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date", 500),
  });

  const { data: returnSeries = [], isLoading: returnsLoading } = useQuery({
    queryKey: ["return-series"],
    queryFn: () => base44.entities.ReturnSeries.list("-created_date", 1000),
  });

  // Auto-select first benchmark
  useEffect(() => {
    if (!benchmarkId && benchmarks.length > 0) {
      setBenchmarkId(benchmarks[0].id);
    }
  }, [benchmarks, benchmarkId]);

  const selectedFirm = availableFirms.find((f) => f.id === firmId);
  const selectedBenchmark = benchmarks.find((b) => b.id === benchmarkId);

  // Product IDs belonging to the selected firm
  const firmProductIds = useMemo(
    () => new Set(products.filter((p) => p.firm_id === firmId).map((p) => p.id)),
    [products, firmId]
  );

  // Portfolio allocation context for the selected firm
  const firmPortfolioContext = useMemo(() => {
    const firmPortfolios = portfolios.filter((p) => p.advisor_firm_id === firmId);
    const totalAllocated = firmPortfolios.reduce((sum, p) => sum + (Number(p.initial_allocation_amount) || 0), 0);
    const activeCount = firmPortfolios.filter((p) => p.funding_status !== "Terminated").length;
    return { totalAllocated, activeCount, portfolioCount: firmPortfolios.length };
  }, [portfolios, firmId]);

  // Build chart data: firm's avg product returns vs benchmark returns
  const chartData = useMemo(() => {
    if (!firmId) return [];

    // Firm's average product return per month
    const firmByMonth = {};
    let firmReturnCount = 0;
    returnSeries.forEach((rs) => {
      if (!firmProductIds.has(rs.product_id)) return;
      (rs.monthly_returns || []).forEach((mr) => {
        const k = dateToMonthKey(mr.date);
        if (!k || !keyToLabel[k]) return;
        if (mr.return_value == null) return;
        if (!firmByMonth[k]) firmByMonth[k] = { sum: 0, count: 0 };
        firmByMonth[k].sum += mr.return_value;
        firmByMonth[k].count += 1;
        firmReturnCount++;
      });
    });

    // Benchmark returns per month
    const benchByMonth = {};
    (selectedBenchmark?.monthly_returns || []).forEach((mr) => {
      const k = dateToMonthKey(mr.date);
      if (!k || !keyToLabel[k]) return;
      benchByMonth[k] = mr.return_value;
    });

    const rows = monthKeys.map((k) => {
      const f = firmByMonth[k];
      const firmMonthly = f && f.count ? Math.round((f.sum / f.count) * 100) / 100 : null;
      const benchMonthly = benchByMonth[k] ?? null;
      return {
        month: keyToLabel[k],
        firmMonthly,
        benchMonthly,
      };
    });

    // Add cumulative columns if needed
    if (viewMode === "cumulative") {
      let firmCum = 100;
      let benchCum = 100;
      return rows.map((r) => {
        if (r.firmMonthly != null) firmCum *= (1 + r.firmMonthly / 100);
        if (r.benchMonthly != null) benchCum *= (1 + r.benchMonthly / 100);
        return {
          ...r,
          firmCumulative: r.firmMonthly != null ? Math.round(firmCum * 100) / 100 : null,
          benchCumulative: r.benchMonthly != null ? Math.round(benchCum * 100) / 100 : null,
        };
      });
    }

    return rows;
  }, [firmId, firmProductIds, returnSeries, selectedBenchmark, monthKeys, keyToLabel, viewMode]);

  const loading = benchmarksLoading || returnsLoading;
  const hasFirmData = chartData.some((r) => r.firmMonthly != null || r.firmCumulative != null);
  const hasBenchData = chartData.some((r) => r.benchMonthly != null || r.benchCumulative != null);

  const fmtValue = (v) => {
    if (v == null) return "—";
    if (viewMode === "cumulative") return v.toFixed(1);
    return `${v}%`;
  };

  // Summary stats
  const firmLatest = viewMode === "cumulative"
    ? chartData.find((r) => r.firmCumulative != null && [...chartData].reverse().find((r2) => r2.firmCumulative != null)?.month === r.month)?.firmCumulative
    : [...chartData].reverse().find((r) => r.firmMonthly != null)?.firmMonthly;
  const benchLatest = viewMode === "cumulative"
    ? [...chartData].reverse().find((r) => r.benchCumulative != null)?.benchCumulative
    : [...chartData].reverse().find((r) => r.benchMonthly != null)?.benchMonthly;
  const diff = (firmLatest != null && benchLatest != null)
    ? Math.round((firmLatest - benchLatest) * 100) / 100
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Firm vs. Benchmark Performance</h2>
            <p className="text-xs text-gray-400">
              Compare firm product returns against market benchmarks · updates with portfolio changes
            </p>
          </div>
        </div>
        {hasFirmData && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => setViewMode("monthly")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "monthly" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("cumulative")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "cumulative" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Cumulative
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Firm {firmPortfolioContext.portfolioCount > 0 && (
              <span className="text-gray-400">· {firmPortfolioContext.portfolioCount} portfolio{firmPortfolioContext.portfolioCount === 1 ? "" : "s"}</span>
            )}
          </label>
          <select
            value={firmId}
            onChange={(e) => setFirmId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            disabled={availableFirms.length === 0}
          >
            {availableFirms.length === 0 ? (
              <option value="">No firms in portfolios</option>
            ) : (
              availableFirms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Benchmark</label>
          <select
            value={benchmarkId}
            onChange={(e) => setBenchmarkId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            disabled={benchmarks.length === 0}
          >
            {benchmarks.length === 0 ? (
              <option value="">No benchmarks available</option>
            ) : (
              benchmarks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4">
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
          </div>
        ) : !firmId ? (
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
            No firms with portfolio allocations found.
          </div>
        ) : !hasFirmData && !hasBenchData ? (
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
            No return data available for this firm or benchmark in the last {MONTHS_BACK} months.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => viewMode === "cumulative" ? v.toFixed(0) : `${v}%`}
                width={55}
              />
              <Tooltip
                formatter={(v) => fmtValue(v)}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                iconType="line"
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              <Line
                type="monotone"
                dataKey={viewMode === "cumulative" ? "firmCumulative" : "firmMonthly"}
                name={selectedFirm?.name || "Firm"}
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={viewMode === "cumulative" ? "benchCumulative" : "benchMonthly"}
                name={selectedBenchmark?.name || "Benchmark"}
                stroke="#e11d48"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary stats */}
      {hasFirmData && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label={viewMode === "cumulative" ? "Firm (cumulative)" : "Firm latest"}
            value={fmtValue(firmLatest)}
            color="text-blue-600"
          />
          <StatCard
            label={viewMode === "cumulative" ? "Benchmark (cumulative)" : "Benchmark latest"}
            value={fmtValue(benchLatest)}
            color="text-rose-600"
          />
          <StatCard
            label="Difference"
            value={diff != null ? `${diff > 0 ? "+" : ""}${fmtValue(diff)}` : "—"}
            color={diff != null && diff >= 0 ? "text-emerald-600" : "text-rose-600"}
          />
          <StatCard
            label="Portfolio allocation"
            value={firmPortfolioContext.totalAllocated > 0
              ? `$${(firmPortfolioContext.totalAllocated / 1e6).toFixed(1)}M`
              : "—"}
            color="text-gray-900"
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value ?? "—"}</p>
    </div>
  );
}