import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO, differenceInMonths } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, Target, Loader2 } from "lucide-react";

const SERIES_COLORS = [
  "#4f46e5", // indigo-600 (portfolio)
  "#0891b2", // cyan-600 (primary benchmark)
  "#16a34a", // green-600
  "#ea580c", // orange-600
  "#db2777", // pink-600
  "#7c3aed", // violet-600
  "#ca8a04", // yellow-600
];

function dateToMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatPct(v) {
  if (v == null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function formatCurrencyShort(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function PortfolioBenchmarkComparisonTab({ portfolio }) {
  const [hiddenSeries, setHiddenSeries] = useState({});

  // Fetch all benchmarks (we'll filter to the ones assigned to this portfolio)
  const { data: allBenchmarks = [], isLoading } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date", 500),
  });

  // Build the list of benchmarks to compare: primary + secondary
  const benchmarksToCompare = useMemo(() => {
    const list = [];
    if (portfolio.primary_benchmark_id) {
      const b = allBenchmarks.find((bm) => bm.id === portfolio.primary_benchmark_id);
      if (b) list.push({ ...b, isPrimary: true });
    }
    (portfolio.secondary_benchmarks || []).forEach((sb) => {
      const b = allBenchmarks.find((bm) => bm.id === sb.benchmark_id);
      if (b) list.push({ ...b, isPrimary: false });
    });
    return list;
  }, [portfolio, allBenchmarks]);

  // Portfolio historical AUM (level: "portfolio")
  const portfolioAum = useMemo(() => {
    return (portfolio.historical_aum || [])
      .filter((a) => a.level === "portfolio" && a.date && a.value != null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [portfolio]);

  // Build chart data: merge portfolio AUM dates with benchmark cumulative returns
  const chartData = useMemo(() => {
    if (portfolioAum.length === 0) return [];

    // Portfolio growth index: base = 100 at first data point
    const firstValue = portfolioAum[0].value;
    if (firstValue == null || firstValue === 0) return [];

    // Collect all unique dates (month-end keys) from portfolio AUM
    const dateMap = new Map(); // dateStr -> { date, portfolio }
    portfolioAum.forEach((a) => {
      dateMap.set(a.date, {
        date: a.date,
        portfolio: (a.value / firstValue) * 100,
      });
    });

    // For each benchmark, compute cumulative growth index aligned to the portfolio's date range
    benchmarksToCompare.forEach((bench) => {
      const returns = (bench.monthly_returns || [])
        .filter((mr) => mr.date && mr.return_value != null)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (returns.length === 0) return;

      // Build cumulative index keyed by month
      let cumulative = 100;
      const cumByMonth = {};
      returns.forEach((mr, i) => {
        if (i === 0) {
          cumulative = 100;
        } else {
          cumulative = cumulative * (1 + (mr.return_value || 0) / 100);
        }
        cumByMonth[dateToMonthKey(mr.date)] = cumulative;
      });

      // Align benchmark to portfolio dates: for each portfolio date, find the benchmark
      // cumulative value at or before that month
      const sortedBenchMonths = Object.keys(cumByMonth).sort();
      dateMap.forEach((row, dateStr) => {
        const monthKey = dateToMonthKey(dateStr);
        if (!monthKey) return;
        // Find the latest benchmark month <= portfolio month
        let matchKey = null;
        for (const mk of sortedBenchMonths) {
          if (mk <= monthKey) matchKey = mk;
          else break;
        }
        if (matchKey) {
          row[bench.id] = cumByMonth[matchKey];
        }
      });
    });

    return Array.from(dateMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [portfolioAum, benchmarksToCompare]);

  // Summary stats
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const first = chartData[0];
    const last = chartData[chartData.length - 1];

    const portfolioReturn = last.portfolio != null && first.portfolio != null
      ? last.portfolio - 100
      : null;

    // Time period in months
    const months = differenceInMonths(parseISO(last.date), parseISO(first.date)) || 1;
    // Annualized return: (end/start)^(12/months) - 1
    const portfolioAnnualized = last.portfolio != null
      ? (Math.pow(last.portfolio / 100, 12 / months) - 1) * 100
      : null;

    const benchmarkStats = benchmarksToCompare.map((bench) => {
      const benchLast = last[bench.id];
      const benchFirst = first[bench.id];
      const totalReturn = benchLast != null && benchFirst != null
        ? benchLast - 100
        : null;
      const annualized = benchLast != null
        ? (Math.pow(benchLast / 100, 12 / months) - 1) * 100
        : null;
      const alpha = portfolioReturn != null && totalReturn != null
        ? portfolioReturn - totalReturn
        : null;
      return {
        id: bench.id,
        name: bench.name,
        isPrimary: bench.isPrimary,
        totalReturn,
        annualized,
        alpha,
      };
    });

    return {
      portfolioReturn,
      portfolioAnnualized,
      months,
      benchmarkStats,
      firstDate: first.date,
      lastDate: last.date,
      firstValue: portfolioAum[0]?.value,
      lastValue: portfolioAum[portfolioAum.length - 1]?.value,
    };
  }, [chartData, benchmarksToCompare, portfolioAum]);

  const toggleSeries = (key) => {
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading benchmarks…
      </div>
    );
  }

  if (portfolioAum.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <BarChart3 className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm text-gray-500 font-medium">No Historical AUM Data</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Add AUM data points in the Historical AUM tab to see benchmark comparison.
        </p>
      </div>
    );
  }

  if (benchmarksToCompare.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <Target className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm text-gray-500 font-medium">No Benchmarks Assigned</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Assign a primary or secondary benchmark to this portfolio in the Details tab to compare performance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Portfolio Return</p>
          <p className={`text-lg font-semibold mt-0.5 ${stats?.portfolioReturn != null ? (stats.portfolioReturn >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
            {formatPct(stats?.portfolioReturn)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {stats ? `${format(parseISO(stats.firstDate), "MM/dd/yy")} → ${format(parseISO(stats.lastDate), "MM/dd/yy")}` : ""}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Annualized Return</p>
          <p className={`text-lg font-semibold mt-0.5 ${stats?.portfolioAnnualized != null ? (stats.portfolioAnnualized >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
            {formatPct(stats?.portfolioAnnualized)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{stats ? `${stats.months} months` : ""}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Starting AUM</p>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">
            {stats?.firstValue != null ? formatCurrencyShort(stats.firstValue) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{stats ? format(parseISO(stats.firstDate), "MM/dd/yyyy") : ""}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Latest AUM</p>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">
            {stats?.lastValue != null ? formatCurrencyShort(stats.lastValue) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{stats ? format(parseISO(stats.lastDate), "MM/dd/yyyy") : ""}</p>
        </div>
      </div>

      {/* Growth chart */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-800">Growth of $100 — Portfolio vs Benchmark</h3>
        </div>
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => (d ? format(parseISO(d), "MM/dd/yy") : "")}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                height={40}
              />
              <YAxis
                tickFormatter={(v) => (v != null ? `${v.toFixed(0)}` : "")}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={50}
              />
              <Tooltip
                labelFormatter={(d) => (d ? format(parseISO(d), "MM/dd/yyyy") : "")}
                formatter={(v, name) => [v != null ? `${v.toFixed(2)}` : "—", name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                onClick={(e) => toggleSeries(e.dataKey)}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                name={portfolio.portfolio_name || "Portfolio"}
                stroke={SERIES_COLORS[0]}
                strokeWidth={2.5}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
                connectNulls
                hide={!!hiddenSeries.portfolio}
              />
              {benchmarksToCompare.map((bench, i) => (
                <Line
                  key={bench.id}
                  type="monotone"
                  dataKey={bench.id}
                  name={bench.name}
                  stroke={SERIES_COLORS[(i + 1) % SERIES_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray={bench.isPrimary ? undefined : "6 4"}
                  dot={{ r: 2 }}
                  connectNulls
                  hide={!!hiddenSeries[bench.id]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Indexed to 100 at the portfolio's first AUM data point. Click a legend entry to toggle visibility.
          {benchmarksToCompare.some((b) => !b.isPrimary) && " Secondary benchmarks shown as dashed lines."}
        </p>
      </div>

      {/* Benchmark comparison table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Performance vs Benchmarks</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Benchmark</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">Total Return</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">Annualized</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">Alpha (vs Portfolio)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 bg-indigo-50/30">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: SERIES_COLORS[0] }} />
                  <span className="text-gray-800 font-medium">{portfolio.portfolio_name || "Portfolio"}</span>
                </div>
              </td>
              <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${stats?.portfolioReturn != null ? (stats.portfolioReturn >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
                {formatPct(stats?.portfolioReturn)}
              </td>
              <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${stats?.portfolioAnnualized != null ? (stats.portfolioAnnualized >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
                {formatPct(stats?.portfolioAnnualized)}
              </td>
              <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">—</td>
            </tr>
            {stats?.benchmarkStats.map((bs) => (
              <tr key={bs.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: SERIES_COLORS[(benchmarksToCompare.findIndex((b) => b.id === bs.id) + 1) % SERIES_COLORS.length] }} />
                    <span className="text-gray-800">{bs.name}</span>
                    {bs.isPrimary && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">Primary</span>}
                  </div>
                </td>
                <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${bs.totalReturn != null ? (bs.totalReturn >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
                  {formatPct(bs.totalReturn)}
                </td>
                <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${bs.annualized != null ? (bs.annualized >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
                  {formatPct(bs.annualized)}
                </td>
                <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${bs.alpha != null ? (bs.alpha >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
                  {bs.alpha != null ? (
                    <span className="inline-flex items-center gap-1">
                      {bs.alpha >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {formatPct(bs.alpha)}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}