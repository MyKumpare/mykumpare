import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, BarChart2, Activity, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Math Helpers ────────────────────────────────────────────────────────────

function compound(rets) {
  return rets.reduce((acc, r) => acc * (1 + r / 100), 1) - 1;
}

function annualize(total, months) {
  if (!months) return null;
  return (Math.pow(1 + total, 12 / months) - 1) * 100;
}

function stdDev(rets) {
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (rets.length - 1);
  return Math.sqrt(v);
}

function maxDrawdown(rets) {
  let peak = 1, val = 1, dd = 0;
  for (const r of rets) {
    val *= 1 + r / 100;
    if (val > peak) peak = val;
    dd = Math.max(dd, (peak - val) / peak);
  }
  return -dd * 100;
}

function fmt(v, d = 2, sign = true) {
  if (v == null || isNaN(v)) return "—";
  const s = sign && v > 0 ? "+" : "";
  return s + v.toFixed(d) + "%";
}

function fmtRaw(v, d = 2, sign = true) {
  if (v == null || isNaN(v)) return "—";
  const s = sign && v > 0 ? "+" : "";
  return s + v.toFixed(d);
}

function computeStats(rets, months) {
  if (!rets.length) return null;
  const tot = compound(rets);
  const ann = annualize(tot, months);
  const mStd = stdDev(rets);
  const vol = mStd != null ? mStd * Math.sqrt(12) : null;
  const sharpe = ann != null && vol ? ann / vol : null;
  const dd = maxDrawdown(rets);
  const hitRate = (rets.filter((r) => r > 0).length / rets.length) * 100;
  return { total: tot * 100, ann, vol, sharpe, dd, hitRate, months };
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

// "YYYY-MM-DD" → comparable string; we compare by YYYY-MM prefix
const ym = (d) => d?.slice(0, 7) ?? "";

function filterByRange(monthly, startYM, endYM) {
  return monthly.filter((m) => ym(m.date) >= startYM && ym(m.date) <= endYM);
}

function trailingSlice(monthly, months) {
  return monthly.slice(-months);
}

function commonRange(productMonthly, bmMonthly) {
  if (!productMonthly.length || !bmMonthly.length) return null;
  const pStart = ym(productMonthly[0].date);
  const pEnd = ym(productMonthly[productMonthly.length - 1].date);
  const bStart = ym(bmMonthly[0].date);
  const bEnd = ym(bmMonthly[bmMonthly.length - 1].date);
  const start = pStart > bStart ? pStart : bStart;
  const end = pEnd < bEnd ? pEnd : bEnd;
  return start <= end ? { start, end } : null;
}

function getCalendarYears(monthly) {
  const years = {};
  monthly.forEach((m) => {
    const y = m.date?.slice(0, 4);
    if (!y) return;
    if (!years[y]) years[y] = [];
    years[y].push(m.return_value);
  });
  return years;
}

function alignBenchmarkReturns(productMonthly, bmMonthly) {
  // Returns only months present in BOTH, keyed by YYYY-MM
  const bmMap = {};
  bmMonthly.forEach((m) => { bmMap[ym(m.date)] = m.return_value; });
  return productMonthly
    .filter((m) => ym(m.date) in bmMap)
    .map((m) => ({ date: m.date, product: m.return_value, benchmark: bmMap[ym(m.date)] }));
}

// ─── UI Sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, positive }) {
  const color = positive === true ? "text-emerald-600" : positive === false ? "text-red-500" : "text-gray-800";
  return (
    <div className="bg-white border rounded-lg p-3 flex flex-col gap-0.5 shadow-sm min-w-0">
      <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
      <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
      {sub != null && <p className="text-xs text-gray-400 truncate">Bm: {sub}</p>}
    </div>
  );
}

const Tooltip2 = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? "+" : ""}{p.value}%
        </p>
      ))}
    </div>
  );
};

const TRAILING_PERIODS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "YTD", months: null }, // special
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "3Y", months: 36 },
  { label: "5Y", months: 60 },
  { label: "7Y", months: 84 },
  { label: "10Y", months: 120 },
  { label: "SI", months: null }, // since inception = full range
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductAnalyticsTab({ productId, editingProduct }) {
  const benchmarkDefs = useMemo(() => {
    const raw = editingProduct?.inv_desc_benchmarks ?? [];
    const objs = raw.map((b) => (typeof b === "string" ? { id: b, role: "" } : b));
    return [
      ...objs.filter((b) => b.role === "Primary"),
      ...objs.filter((b) => b.role === "Secondary"),
      ...objs.filter((b) => b.role !== "Primary" && b.role !== "Secondary"),
    ];
  }, [editingProduct]);

  const [selectedBmId, setSelectedBmId] = useState(null);
  const [bmDropdownOpen, setBmDropdownOpen] = useState(false);

  // Fetch product return series
  const { data: seriesList = [], isLoading: loadingSeries } = useQuery({
    queryKey: ["return-series", productId],
    queryFn: () => base44.entities.ReturnSeries.filter({ product_id: productId }),
    enabled: !!productId,
  });

  // Fetch all benchmarks (only if product has benchmarks)
  const { data: allBenchmarks = [], isLoading: loadingBm } = useQuery({
    queryKey: ["benchmarks-all"],
    queryFn: () => base44.entities.Benchmark.list(),
    enabled: benchmarkDefs.length > 0,
  });

  // Product returns (sorted)
  const productMonthly = useMemo(() => {
    const s = seriesList.find((s) => s.monthly_returns?.length > 0) ?? seriesList[0];
    return (s?.monthly_returns ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  }, [seriesList]);

  // Active benchmark id (default = first Primary, then first in list)
  const activeBmId = selectedBmId ?? benchmarkDefs[0]?.id ?? null;

  const activeBm = useMemo(
    () => allBenchmarks.find((b) => b.id === activeBmId) ?? null,
    [allBenchmarks, activeBmId]
  );

  const bmMonthly = useMemo(
    () => (activeBm?.monthly_returns ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [activeBm]
  );

  // Common range
  const commonRng = useMemo(() => commonRange(productMonthly, bmMonthly), [productMonthly, bmMonthly]);

  // Date range state — default to common range (or full product range)
  const defaultStart = commonRng?.start ?? ym(productMonthly[0]?.date) ?? "";
  const defaultEnd = commonRng?.end ?? ym(productMonthly[productMonthly.length - 1]?.date) ?? "";
  const [startYM, setStartYM] = useState("");
  const [endYM, setEndYM] = useState("");

  const effectiveStart = startYM || defaultStart;
  const effectiveEnd = endYM || defaultEnd;

  // Trailing period toggles
  const [selectedTrailing, setSelectedTrailing] = useState(
    new Set(["1Y", "3Y", "5Y", "SI"])
  );

  // ── Filtered slices ──────────────────────────────────────────────────────
  const filteredProduct = useMemo(
    () => filterByRange(productMonthly, effectiveStart, effectiveEnd),
    [productMonthly, effectiveStart, effectiveEnd]
  );

  const filteredBm = useMemo(
    () => filterByRange(bmMonthly, effectiveStart, effectiveEnd),
    [bmMonthly, effectiveStart, effectiveEnd]
  );

  // Aligned for relative analysis
  const aligned = useMemo(
    () => alignBenchmarkReturns(filteredProduct, filteredBm),
    [filteredProduct, filteredBm]
  );

  // ── Cumulative chart data ────────────────────────────────────────────────
  const chartData = useMemo(() => {
    let cp = 1, cb = 1;
    const pMap = {};
    filteredProduct.forEach((m) => { pMap[ym(m.date)] = m.return_value; });
    const bMap = {};
    filteredBm.forEach((m) => { bMap[ym(m.date)] = m.return_value; });
    const dates = [...new Set([...Object.keys(pMap), ...Object.keys(bMap)])].sort();
    return dates.map((d) => {
      const pr = pMap[d];
      const br = bMap[d];
      if (pr != null) cp *= 1 + pr / 100;
      if (br != null) cb *= 1 + br / 100;
      return {
        date: d,
        product: pr != null ? parseFloat(pr.toFixed(2)) : null,
        benchmark: br != null ? parseFloat(br.toFixed(2)) : null,
        cumProduct: pr != null ? parseFloat(((cp - 1) * 100).toFixed(2)) : null,
        cumBenchmark: br != null ? parseFloat(((cb - 1) * 100).toFixed(2)) : null,
        excess: pr != null && br != null ? parseFloat((pr - br).toFixed(2)) : null,
      };
    });
  }, [filteredProduct, filteredBm]);

  // ── Period stats ─────────────────────────────────────────────────────────
  const productStats = useMemo(() => computeStats(filteredProduct.map((m) => m.return_value), filteredProduct.length), [filteredProduct]);
  const bmStats = useMemo(() => computeStats(filteredBm.map((m) => m.return_value), filteredBm.length), [filteredBm]);
  const excessAnn = productStats?.ann != null && bmStats?.ann != null ? productStats.ann - bmStats.ann : null;
  const trackingErr = aligned.length >= 2 ? stdDev(aligned.map((r) => r.product - r.benchmark)) * Math.sqrt(12) : null;
  const infoRatio = excessAnn != null && trackingErr ? excessAnn / trackingErr : null;

  // ── Trailing returns ─────────────────────────────────────────────────────
  const trailingData = useMemo(() => {
    const now = new Date();
    const ytdStart = `${now.getFullYear()}-01`;
    return TRAILING_PERIODS.map((p) => {
      let pSlice, bSlice;
      if (p.label === "SI") {
        pSlice = filteredProduct;
        bSlice = filteredBm;
      } else if (p.label === "YTD") {
        pSlice = filteredProduct.filter((m) => ym(m.date) >= ytdStart);
        bSlice = filteredBm.filter((m) => ym(m.date) >= ytdStart);
      } else {
        pSlice = trailingSlice(filteredProduct, p.months);
        bSlice = trailingSlice(filteredBm, p.months);
      }
      const ps = pSlice.length ? compound(pSlice.map((m) => m.return_value)) * 100 : null;
      const bs = bSlice.length ? compound(bSlice.map((m) => m.return_value)) * 100 : null;

      // Annualize if > 12 months
      const annualized = p.months > 12 || p.label === "SI";
      const months = pSlice.length;
      const pAnn = annualized && months >= 12 && ps != null ? annualize(ps / 100, months) : ps;
      const bAnn = annualized && months >= 12 && bs != null ? annualize(bs / 100, months) : bs;

      return {
        label: p.label,
        product: pAnn,
        benchmark: bAnn,
        excess: pAnn != null && bAnn != null ? pAnn - bAnn : null,
        annualized,
        hasData: pSlice.length > 0,
      };
    });
  }, [filteredProduct, filteredBm]);

  // ── Calendar Year data ───────────────────────────────────────────────────
  const calendarYears = useMemo(() => {
    const pYears = getCalendarYears(filteredProduct);
    const bYears = getCalendarYears(filteredBm);
    const allYears = [...new Set([...Object.keys(pYears), ...Object.keys(bYears)])].sort().reverse();
    return allYears.map((y) => {
      const pr = pYears[y] ? compound(pYears[y]) * 100 : null;
      const br = bYears[y] ? compound(bYears[y]) * 100 : null;
      return { year: y, product: pr, benchmark: br, excess: pr != null && br != null ? pr - br : null };
    });
  }, [filteredProduct, filteredBm]);

  const isLoading = loadingSeries || loadingBm;

  if (isLoading) {
    return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading analytics...</div>;
  }

  if (!productMonthly.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
        <BarChart2 className="w-8 h-8 opacity-40" />
        <p className="text-sm">No return data available yet.</p>
        <p className="text-xs">Upload returns in the Returns tab to see analytics.</p>
      </div>
    );
  }

  const bmLabel = (id) => {
    const bm = allBenchmarks.find((b) => b.id === id);
    const def = benchmarkDefs.find((b) => b.id === id);
    return bm ? bm.name + (def?.role ? ` (${def.role})` : "") : id;
  };

  const xTickFmt = (t) => t?.slice(0, 7) ?? "";

  return (
    <div className="space-y-5 pb-4">
      {/* ── Benchmark selector ── */}
      {benchmarkDefs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Benchmark:</span>
          <div className="relative">
            <button
              onClick={() => setBmDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2.5 py-1 hover:bg-indigo-100 transition-colors"
            >
              {activeBmId ? (allBenchmarks.find((b) => b.id === activeBmId)?.name ?? "—") : "None"}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {bmDropdownOpen && (
              <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] py-1">
                {benchmarkDefs.map((b) => {
                  const bm = allBenchmarks.find((x) => x.id === b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => { setSelectedBmId(b.id); setBmDropdownOpen(false); setStartYM(""); setEndYM(""); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between gap-2 ${b.id === activeBmId ? "text-indigo-700 font-semibold bg-indigo-50" : "text-gray-700"}`}
                    >
                      <span>{bm?.name ?? b.id}</span>
                      {b.role && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${b.role === "Primary" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                          {b.role}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {activeBm && (
            <span className="text-xs text-gray-400">
              {bmMonthly.length} months of data
            </span>
          )}
        </div>
      )}

      {/* ── Date range editor ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Period:</span>
        <input
          type="month"
          value={effectiveStart}
          min={ym(productMonthly[0]?.date)}
          max={effectiveEnd}
          onChange={(e) => setStartYM(e.target.value)}
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="month"
          value={effectiveEnd}
          min={effectiveStart}
          max={ym(productMonthly[productMonthly.length - 1]?.date)}
          onChange={(e) => setEndYM(e.target.value)}
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        {(startYM || endYM) && (
          <button
            onClick={() => { setStartYM(""); setEndYM(""); }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Reset
          </button>
        )}
        {commonRng && (
          <button
            onClick={() => { setStartYM(commonRng.start); setEndYM(commonRng.end); }}
            className="text-xs text-gray-500 hover:text-indigo-600 hover:underline"
          >
            Common period
          </button>
        )}
        <span className="text-xs text-gray-400">({filteredProduct.length} months)</span>
      </div>

      {/* ── Summary stat cards ── */}
      {productStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Ann. Return" value={fmt(productStats.ann)} sub={bmStats ? fmt(bmStats.ann) : null} positive={productStats.ann > 0 ? true : productStats.ann < 0 ? false : undefined} />
          <StatCard label="Ann. Volatility" value={fmt(productStats.vol)} sub={bmStats ? fmt(bmStats.vol) : null} />
          <StatCard label="Sharpe Ratio" value={fmtRaw(productStats.sharpe, 2, true)} sub={bmStats ? fmtRaw(bmStats.sharpe, 2, true) : null} positive={productStats.sharpe > 1 ? true : productStats.sharpe < 0 ? false : undefined} />
          <StatCard label="Max Drawdown" value={fmt(productStats.dd)} sub={bmStats ? fmt(bmStats.dd) : null} positive={false} />
          {activeBm && (
            <>
              <StatCard label="Excess Return (Ann.)" value={fmt(excessAnn)} positive={excessAnn > 0 ? true : excessAnn < 0 ? false : undefined} />
              <StatCard label="Tracking Error (Ann.)" value={fmt(trackingErr)} />
              <StatCard label="Information Ratio" value={fmtRaw(infoRatio)} positive={infoRatio > 0.5 ? true : infoRatio < 0 ? false : undefined} />
              <StatCard label="Hit Rate (vs Bm)" value={aligned.length ? ((aligned.filter((r) => r.product > r.benchmark).length / aligned.length) * 100).toFixed(1) + "%" : "—"} positive={aligned.length && (aligned.filter((r) => r.product > r.benchmark).length / aligned.length) >= 0.5} />
            </>
          )}
        </div>
      )}

      {/* ── Cumulative return chart ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cumulative Return</p>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={xTickFmt} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={44} />
            <Tooltip content={<Tooltip2 />} />
            <ReferenceLine y={0} stroke="#ccc" />
            <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="cumProduct" stroke="#6366f1" strokeWidth={2} dot={false} name="Product" />
            {activeBm && <Line type="monotone" dataKey="cumBenchmark" stroke="#f59e0b" strokeWidth={2} dot={false} name={activeBm.name} strokeDasharray="4 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Monthly excess return bar chart ── */}
      {activeBm && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Excess Return (Product − Benchmark)</p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={xTickFmt} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={44} />
              <Tooltip content={<Tooltip2 />} />
              <ReferenceLine y={0} stroke="#999" />
              <Bar dataKey="excess" name="Excess" isAnimationActive={false} radius={[2, 2, 0, 0]}
                fill="#6366f1"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Monthly product vs benchmark bar chart ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Returns</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={xTickFmt} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={44} />
            <Tooltip content={<Tooltip2 />} />
            <ReferenceLine y={0} stroke="#999" />
            <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="product" name="Product" fill="#6366f1" isAnimationActive={false} radius={[2, 2, 0, 0]} />
            {activeBm && <Bar dataKey="benchmark" name={activeBm.name} fill="#f59e0b" isAnimationActive={false} radius={[2, 2, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Trailing returns table ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trailing Returns</p>
          <div className="flex flex-wrap gap-1">
            {TRAILING_PERIODS.map((p) => (
              <button
                key={p.label}
                onClick={() => setSelectedTrailing((prev) => {
                  const next = new Set(prev);
                  next.has(p.label) ? next.delete(p.label) : next.add(p.label);
                  return next;
                })}
                className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${selectedTrailing.has(p.label) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <td className="py-1.5 pr-3 font-semibold text-gray-600 text-left">Period</td>
                <td className="py-1.5 px-2 font-semibold text-gray-600 text-right">Product</td>
                {activeBm && (
                  <>
                    <td className="py-1.5 px-2 font-semibold text-gray-600 text-right">{activeBm.name}</td>
                    <td className="py-1.5 pl-2 font-semibold text-gray-600 text-right">Excess</td>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {trailingData
                .filter((r) => selectedTrailing.has(r.label) && r.hasData)
                .map((r) => (
                  <tr key={r.label} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-gray-700 font-medium">
                      {r.label}
                      {r.annualized && r.hasData && <span className="text-gray-400 font-normal"> (ann.)</span>}
                    </td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${r.product > 0 ? "text-emerald-600" : r.product < 0 ? "text-red-500" : "text-gray-600"}`}>
                      {fmt(r.product)}
                    </td>
                    {activeBm && (
                      <>
                        <td className={`py-1.5 px-2 text-right ${r.benchmark > 0 ? "text-emerald-600" : r.benchmark < 0 ? "text-red-500" : "text-gray-500"}`}>
                          {fmt(r.benchmark)}
                        </td>
                        <td className={`py-1.5 pl-2 text-right font-semibold ${r.excess > 0 ? "text-emerald-600" : r.excess < 0 ? "text-red-500" : "text-gray-500"}`}>
                          {fmt(r.excess)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Calendar year table ── */}
      {calendarYears.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Calendar Year Returns</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <td className="py-1.5 pr-3 font-semibold text-gray-600 text-left">Year</td>
                  <td className="py-1.5 px-2 font-semibold text-gray-600 text-right">Product</td>
                  {activeBm && (
                    <>
                      <td className="py-1.5 px-2 font-semibold text-gray-600 text-right">{activeBm.name}</td>
                      <td className="py-1.5 pl-2 font-semibold text-gray-600 text-right">Excess</td>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {calendarYears.map((r) => (
                  <tr key={r.year} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-gray-700 font-medium">{r.year}</td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${r.product > 0 ? "text-emerald-600" : r.product < 0 ? "text-red-500" : "text-gray-600"}`}>
                      {fmt(r.product)}
                    </td>
                    {activeBm && (
                      <>
                        <td className={`py-1.5 px-2 text-right ${r.benchmark > 0 ? "text-emerald-600" : r.benchmark < 0 ? "text-red-500" : "text-gray-500"}`}>
                          {fmt(r.benchmark)}
                        </td>
                        <td className={`py-1.5 pl-2 text-right font-semibold ${r.excess > 0 ? "text-emerald-600" : r.excess < 0 ? "text-red-500" : "text-gray-500"}`}>
                          {fmt(r.excess)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}