import React, { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { BarChart2, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

// ─── Math Helpers ─────────────────────────────────────────────────────────────

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

function fmtNum(v, d = 2) {
  if (v == null || isNaN(v)) return "—";
  const s = v > 0 ? "+" : "";
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

const ym = (d) => d?.slice(0, 7) ?? "";

function filterByRange(monthly, startYM, endYM) {
  return monthly.filter((m) => ym(m.date) >= startYM && ym(m.date) <= endYM);
}

function commonRange(a, b) {
  if (!a.length || !b.length) return null;
  const start = [ym(a[0].date), ym(b[0].date)].sort().pop();
  const end = [ym(a[a.length - 1].date), ym(b[b.length - 1].date)].sort()[0];
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

// ─── Constants ────────────────────────────────────────────────────────────────

const TRAILING_PERIODS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "YTD", months: null, ytd: true },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "3Y", months: 36 },
  { label: "5Y", months: 60 },
  { label: "7Y", months: 84 },
  { label: "10Y", months: 120 },
  { label: "SI", months: null, si: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, positive }) {
  const color =
    positive === true ? "text-emerald-600" :
    positive === false ? "text-red-500" : "text-gray-800";
  return (
    <div className="bg-white border rounded-lg p-3 flex flex-col gap-0.5 shadow-sm min-w-0">
      <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
      <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
      {sub != null && <p className="text-xs text-gray-400 truncate">Bm: {sub}</p>}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
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

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductAnalyticsTab({ productId, editingProduct }) {
  // ── Benchmark definitions (Primary first, Secondary second, rest alpha) ──
  const benchmarkDefs = useMemo(() => {
    const raw = editingProduct?.inv_desc_benchmarks ?? [];
    const objs = raw.map((b) => (typeof b === "string" ? { id: b, role: "" } : b));
    return [
      ...objs.filter((b) => b.role === "Primary"),
      ...objs.filter((b) => b.role === "Secondary"),
      ...objs.filter((b) => b.role !== "Primary" && b.role !== "Secondary"),
    ];
  }, [editingProduct]);

  // ── UI state ──
  const [selectedBmId, setSelectedBmId] = useState(null);
  const [bmDropdownOpen, setBmDropdownOpen] = useState(false);
  const bmBtnRef = useRef(null);
  const [bmDropdownPos, setBmDropdownPos] = useState({ top: 0, left: 0 });
  const [startYM, setStartYM] = useState("");
  const [endYM, setEndYM] = useState("");
  const [returnType, setReturnType] = useState("gross"); // "gross" | "net" | "both"
  const [chartMode, setChartMode] = useState("cumulative"); // "cumulative" | "excess"
  const [selectedTrailing, setSelectedTrailing] = useState(new Set(["1Y", "3Y", "5Y", "SI"]));

  // Close benchmark dropdown on outside click
  useEffect(() => {
    if (!bmDropdownOpen) return;
    const handler = (e) => {
      if (bmBtnRef.current && !bmBtnRef.current.contains(e.target)) {
        setBmDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bmDropdownOpen]);

  // ── Data fetching ──
  const { data: seriesList = [], isLoading: loadingSeries } = useQuery({
    queryKey: ["return-series", productId],
    queryFn: () => base44.entities.ReturnSeries.filter({ product_id: productId }),
    enabled: !!productId,
  });

  const { data: allBenchmarks = [], isLoading: loadingBm } = useQuery({
    queryKey: ["benchmarks-all"],
    queryFn: () => base44.entities.Benchmark.list(),
    enabled: benchmarkDefs.length > 0,
  });

  // ── Product monthly returns ──
  const productSeries = useMemo(
    () => seriesList.find((s) => s.monthly_returns?.length > 0) ?? seriesList[0] ?? null,
    [seriesList]
  );

  const grossMonthly = useMemo(
    () => (productSeries?.monthly_returns ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [productSeries]
  );

  const netMonthly = useMemo(
    () => grossMonthly.filter((m) => m.net_return != null).map((m) => ({ ...m, return_value: m.net_return })),
    [grossMonthly]
  );

  const hasNet = netMonthly.length > 0;

  // ── Active benchmark ──
  const activeBmId = selectedBmId ?? benchmarkDefs[0]?.id ?? null;
  const activeBm = useMemo(() => allBenchmarks.find((b) => b.id === activeBmId) ?? null, [allBenchmarks, activeBmId]);
  const bmMonthly = useMemo(
    () => (activeBm?.monthly_returns ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [activeBm]
  );

  // ── Common range ──
  const commonRng = useMemo(() => commonRange(grossMonthly, bmMonthly), [grossMonthly, bmMonthly]);
  const defaultStart = commonRng?.start ?? ym(grossMonthly[0]?.date) ?? "";
  const defaultEnd = commonRng?.end ?? ym(grossMonthly[grossMonthly.length - 1]?.date) ?? "";
  const effectiveStart = startYM || defaultStart;
  const effectiveEnd = endYM || defaultEnd;

  // ── Filtered slices ──
  const filteredGross = useMemo(() => filterByRange(grossMonthly, effectiveStart, effectiveEnd), [grossMonthly, effectiveStart, effectiveEnd]);
  const filteredNet = useMemo(() => filterByRange(netMonthly, effectiveStart, effectiveEnd), [netMonthly, effectiveStart, effectiveEnd]);
  const filteredBm = useMemo(() => filterByRange(bmMonthly, effectiveStart, effectiveEnd), [bmMonthly, effectiveStart, effectiveEnd]);

  // ── Return series to use based on selected returnType ──
  // "gross" → gross only; "net" → net only; "both" → gross + net shown together
  const primaryProduct = returnType === "net" ? filteredNet : filteredGross;

  // ── Stats ──
  const grossStats = useMemo(() => computeStats(filteredGross.map((m) => m.return_value), filteredGross.length), [filteredGross]);
  const netStats = useMemo(() => computeStats(filteredNet.map((m) => m.return_value), filteredNet.length), [filteredNet]);
  const bmStats = useMemo(() => computeStats(filteredBm.map((m) => m.return_value), filteredBm.length), [filteredBm]);

  const activeStats = returnType === "net" ? netStats : grossStats;

  // Relative stats (vs benchmark)
  const excessAnn = activeStats?.ann != null && bmStats?.ann != null ? activeStats.ann - bmStats.ann : null;
  const alignedForTE = useMemo(() => {
    const bmMap = {};
    filteredBm.forEach((m) => { bmMap[ym(m.date)] = m.return_value; });
    return primaryProduct.filter((m) => ym(m.date) in bmMap).map((m) => m.return_value - bmMap[ym(m.date)]);
  }, [primaryProduct, filteredBm]);
  const trackingErr = alignedForTE.length >= 2 ? (stdDev(alignedForTE) ?? 0) * Math.sqrt(12) : null;
  const infoRatio = excessAnn != null && trackingErr ? excessAnn / trackingErr : null;
  const hitRateVsBm = useMemo(() => {
    const bmMap = {};
    filteredBm.forEach((m) => { bmMap[ym(m.date)] = m.return_value; });
    const pairs = primaryProduct.filter((m) => ym(m.date) in bmMap);
    if (!pairs.length) return null;
    return (pairs.filter((m) => m.return_value > bmMap[ym(m.date)]).length / pairs.length) * 100;
  }, [primaryProduct, filteredBm]);

  // ── Chart data ──
  const chartData = useMemo(() => {
    let cGross = 1, cNet = 1, cBm = 1;
    const gMap = {}, nMap = {}, bMap = {};
    filteredGross.forEach((m) => { gMap[ym(m.date)] = m.return_value; });
    filteredNet.forEach((m) => { nMap[ym(m.date)] = m.return_value; });
    filteredBm.forEach((m) => { bMap[ym(m.date)] = m.return_value; });
    const dates = [...new Set([...Object.keys(gMap), ...Object.keys(bMap)])].sort();
    return dates.map((d) => {
      const g = gMap[d], n = nMap[d], b = bMap[d];
      if (g != null) cGross *= 1 + g / 100;
      if (n != null) cNet *= 1 + n / 100;
      if (b != null) cBm *= 1 + b / 100;
      const cumGross = g != null ? parseFloat(((cGross - 1) * 100).toFixed(2)) : null;
      const cumNet = n != null ? parseFloat(((cNet - 1) * 100).toFixed(2)) : null;
      const cumBm = b != null ? parseFloat(((cBm - 1) * 100).toFixed(2)) : null;
      return {
        date: d,
        grossReturn: g != null ? parseFloat(g.toFixed(2)) : null,
        netReturn: n != null ? parseFloat(n.toFixed(2)) : null,
        bmReturn: b != null ? parseFloat(b.toFixed(2)) : null,
        cumGross,
        cumNet,
        cumBm,
        excessGross: cumGross != null && cumBm != null ? parseFloat((cumGross - cumBm).toFixed(2)) : null,
        excessNet: cumNet != null && cumBm != null ? parseFloat((cumNet - cumBm).toFixed(2)) : null,
        monthlyExcessGross: g != null && b != null ? parseFloat((g - b).toFixed(2)) : null,
        monthlyExcessNet: n != null && b != null ? parseFloat((n - b).toFixed(2)) : null,
      };
    });
  }, [filteredGross, filteredNet, filteredBm]);

  // ── Trailing returns ──
  const trailingData = useMemo(() => {
    const ytdStart = `${new Date().getFullYear()}-01`;
    return TRAILING_PERIODS.map((p) => {
      const slice = (arr) => {
        if (p.si) return arr;
        if (p.ytd) return arr.filter((m) => ym(m.date) >= ytdStart);
        return arr.slice(-p.months);
      };
      const gSlice = slice(filteredGross);
      const nSlice = slice(filteredNet);
      const bSlice = slice(filteredBm);
      const calc = (arr) => {
        if (!arr.length) return null;
        const tot = compound(arr.map((m) => m.return_value));
        const annualized = (p.months > 12 || p.si) && arr.length >= 12;
        return annualized ? annualize(tot, arr.length) : tot * 100;
      };
      const g = calc(gSlice), n = calc(nSlice), b = calc(bSlice);
      const annualized = (p.months > 12 || p.si) && gSlice.length >= 12;
      return {
        label: p.label, annualized,
        gross: g, net: n, benchmark: b,
        excessGross: g != null && b != null ? g - b : null,
        excessNet: n != null && b != null ? n - b : null,
        hasData: gSlice.length > 0,
      };
    });
  }, [filteredGross, filteredNet, filteredBm]);

  // ── Calendar years ──
  const calendarYears = useMemo(() => {
    const gYears = getCalendarYears(filteredGross);
    const nYears = getCalendarYears(filteredNet);
    const bYears = getCalendarYears(filteredBm);
    const allYears = [...new Set([...Object.keys(gYears), ...Object.keys(bYears)])].sort().reverse();
    return allYears.map((y) => {
      const g = gYears[y] ? compound(gYears[y]) * 100 : null;
      const n = nYears[y] ? compound(nYears[y]) * 100 : null;
      const b = bYears[y] ? compound(bYears[y]) * 100 : null;
      return { year: y, gross: g, net: n, benchmark: b,
        excessGross: g != null && b != null ? g - b : null,
        excessNet: n != null && b != null ? n - b : null,
      };
    });
  }, [filteredGross, filteredNet, filteredBm]);

  const isLoading = loadingSeries || loadingBm;

  if (isLoading) {
    return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading analytics...</div>;
  }

  if (!grossMonthly.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
        <BarChart2 className="w-8 h-8 opacity-40" />
        <p className="text-sm">No return data available yet.</p>
        <p className="text-xs">Upload returns in the Returns tab to see analytics.</p>
      </div>
    );
  }

  const xFmt = (t) => t?.slice(0, 7) ?? "";
  const showGross = returnType === "gross" || returnType === "both";
  const showNet = (returnType === "net" || returnType === "both") && hasNet;

  // Cumulative line chart keys
  const cumChartKey = chartMode === "cumulative"
    ? { gross: "cumGross", net: "cumNet", bm: "cumBm" }
    : { gross: "excessGross", net: "excessNet", bm: null };

  return (
    <div className="space-y-5 pb-4">

      {/* ── Product name ── */}
      <div>
        <p className="text-base font-bold text-gray-900">{editingProduct?.name}</p>
        {editingProduct?.firm_name && (
          <p className="text-xs text-gray-500">{editingProduct.firm_name}</p>
        )}
      </div>

      {/* ── Controls row ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Benchmark selector */}
        {benchmarkDefs.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium">Benchmark:</span>
            <div ref={bmBtnRef} className="relative">
              <button
                onClick={() => {
                  if (!bmDropdownOpen && bmBtnRef.current) {
                    const rect = bmBtnRef.current.getBoundingClientRect();
                    setBmDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
                  }
                  setBmDropdownOpen((v) => !v);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2.5 py-1 hover:bg-indigo-100 transition-colors"
              >
                {activeBmId ? (allBenchmarks.find((b) => b.id === activeBmId)?.name ?? "—") : "None"}
                <ChevronDown className="w-3 h-3" />
              </button>
              {bmDropdownOpen && createPortal(
                <div
                  style={{ position: "fixed", top: bmDropdownPos.top - window.scrollY, left: bmDropdownPos.left, zIndex: 9999 }}
                  className="bg-white border border-gray-200 rounded-lg shadow-xl min-w-[220px] py-1"
                >
                  {benchmarkDefs.map((b) => {
                    const bm = allBenchmarks.find((x) => x.id === b.id);
                    return (
                      <button
                        key={b.id}
                        onMouseDown={(e) => e.stopPropagation()}
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
                </div>,
                document.body
              )}
            </div>
          </div>
        )}

        {/* Gross / Net selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">Return:</span>
          <div className="flex gap-1">
            <ToggleButton active={returnType === "gross"} onClick={() => setReturnType("gross")}>Gross</ToggleButton>
            {hasNet && <ToggleButton active={returnType === "net"} onClick={() => setReturnType("net")}>Net</ToggleButton>}
            {hasNet && <ToggleButton active={returnType === "both"} onClick={() => setReturnType("both")}>Both</ToggleButton>}
          </div>
        </div>
      </div>

      {/* ── Date range ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Period:</span>
        <input
          type="month"
          value={effectiveStart}
          min={ym(grossMonthly[0]?.date)}
          max={effectiveEnd}
          onChange={(e) => setStartYM(e.target.value)}
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="month"
          value={effectiveEnd}
          min={effectiveStart}
          max={ym(grossMonthly[grossMonthly.length - 1]?.date)}
          onChange={(e) => setEndYM(e.target.value)}
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        {(startYM || endYM) && (
          <button onClick={() => { setStartYM(""); setEndYM(""); }} className="text-xs text-indigo-600 hover:underline">Reset</button>
        )}
        {commonRng && (
          <button onClick={() => { setStartYM(commonRng.start); setEndYM(commonRng.end); }} className="text-xs text-gray-500 hover:text-indigo-600 hover:underline">
            Common period
          </button>
        )}
        <span className="text-xs text-gray-400">({filteredGross.length} months)</span>
      </div>

      {/* ── Stat cards ── */}
      {activeStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Ann. Return" value={fmt(activeStats.ann)} sub={bmStats ? fmt(bmStats.ann) : null} positive={activeStats.ann > 0 ? true : activeStats.ann < 0 ? false : undefined} />
          <StatCard label="Ann. Volatility" value={fmt(activeStats.vol)} sub={bmStats ? fmt(bmStats.vol) : null} />
          <StatCard label="Sharpe Ratio" value={fmtNum(activeStats.sharpe)} sub={bmStats ? fmtNum(bmStats.sharpe) : null} positive={activeStats.sharpe > 1 ? true : activeStats.sharpe < 0 ? false : undefined} />
          <StatCard label="Max Drawdown" value={fmt(activeStats.dd)} sub={bmStats ? fmt(bmStats.dd) : null} positive={false} />
          {activeBm && (
            <>
              <StatCard label="Excess Return (Ann.)" value={fmt(excessAnn)} positive={excessAnn > 0 ? true : excessAnn < 0 ? false : undefined} />
              <StatCard label="Tracking Error (Ann.)" value={fmt(trackingErr)} />
              <StatCard label="Information Ratio" value={fmtNum(infoRatio)} positive={infoRatio > 0.5 ? true : infoRatio < 0 ? false : undefined} />
              <StatCard label="Hit Rate (vs Bm)" value={hitRateVsBm != null ? hitRateVsBm.toFixed(1) + "%" : "—"} positive={hitRateVsBm >= 50} />
            </>
          )}
        </div>
      )}

      {/* ── Cumulative chart with toggle ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {chartMode === "cumulative" ? "Cumulative Return" : "Cumulative Excess Return"}
          </p>
          {activeBm && (
            <div className="flex gap-1">
              <ToggleButton active={chartMode === "cumulative"} onClick={() => setChartMode("cumulative")}>Cumulative</ToggleButton>
              <ToggleButton active={chartMode === "excess"} onClick={() => setChartMode("excess")}>Excess</ToggleButton>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={46} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#ccc" />
            <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
            {showGross && (
              <Line type="monotone" dataKey={cumChartKey.gross} stroke="#6366f1" strokeWidth={2} dot={false} name="Gross" connectNulls />
            )}
            {showNet && (
              <Line type="monotone" dataKey={cumChartKey.net} stroke="#10b981" strokeWidth={2} dot={false} name="Net" strokeDasharray="5 3" connectNulls />
            )}
            {activeBm && chartMode === "cumulative" && (
              <Line type="monotone" dataKey={cumChartKey.bm} stroke="#f59e0b" strokeWidth={2} dot={false} name={activeBm.name} strokeDasharray="4 3" connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Monthly excess return chart ── */}
      {activeBm && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Excess Return</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={46} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#999" />
              {showGross && <Bar dataKey="monthlyExcessGross" name="Gross Excess" fill="#6366f1" isAnimationActive={false} radius={[2, 2, 0, 0]} />}
              {showNet && <Bar dataKey="monthlyExcessNet" name="Net Excess" fill="#10b981" isAnimationActive={false} radius={[2, 2, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Monthly return chart ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Returns</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v + "%"} width={46} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#999" />
            <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
            {showGross && <Bar dataKey="grossReturn" name="Gross" fill="#6366f1" isAnimationActive={false} radius={[2, 2, 0, 0]} />}
            {showNet && <Bar dataKey="netReturn" name="Net" fill="#10b981" isAnimationActive={false} radius={[2, 2, 0, 0]} />}
            {activeBm && <Bar dataKey="bmReturn" name={activeBm.name} fill="#f59e0b" isAnimationActive={false} radius={[2, 2, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Trailing returns ── */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trailing Returns</p>
          <div className="flex flex-wrap gap-1">
            {TRAILING_PERIODS.map((p) => (
              <ToggleButton
                key={p.label}
                active={selectedTrailing.has(p.label)}
                onClick={() => setSelectedTrailing((prev) => {
                  const next = new Set(prev);
                  next.has(p.label) ? next.delete(p.label) : next.add(p.label);
                  return next;
                })}
              >
                {p.label}
              </ToggleButton>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-1.5 pr-3 text-left font-semibold text-gray-600">Period</th>
                {showGross && <th className="py-1.5 px-2 text-right font-semibold text-gray-600">Gross</th>}
                {showNet && <th className="py-1.5 px-2 text-right font-semibold text-gray-600">Net</th>}
                {activeBm && <th className="py-1.5 px-2 text-right font-semibold text-gray-600">{activeBm.name}</th>}
                {activeBm && showGross && <th className="py-1.5 pl-2 text-right font-semibold text-gray-600">Excess (G)</th>}
                {activeBm && showNet && <th className="py-1.5 pl-2 text-right font-semibold text-gray-600">Excess (N)</th>}
              </tr>
            </thead>
            <tbody>
              {trailingData.filter((r) => selectedTrailing.has(r.label) && r.hasData).map((r) => (
                <tr key={r.label} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 pr-3 text-gray-700 font-medium">
                    {r.label}{r.annualized && <span className="text-gray-400 font-normal"> (ann.)</span>}
                  </td>
                  {showGross && <td className={`py-1.5 px-2 text-right font-semibold ${r.gross > 0 ? "text-emerald-600" : r.gross < 0 ? "text-red-500" : "text-gray-600"}`}>{fmt(r.gross)}</td>}
                  {showNet && <td className={`py-1.5 px-2 text-right font-semibold ${r.net > 0 ? "text-emerald-600" : r.net < 0 ? "text-red-500" : "text-gray-600"}`}>{fmt(r.net)}</td>}
                  {activeBm && <td className={`py-1.5 px-2 text-right ${r.benchmark > 0 ? "text-emerald-600" : r.benchmark < 0 ? "text-red-500" : "text-gray-500"}`}>{fmt(r.benchmark)}</td>}
                  {activeBm && showGross && <td className={`py-1.5 pl-2 text-right font-semibold ${r.excessGross > 0 ? "text-emerald-600" : r.excessGross < 0 ? "text-red-500" : "text-gray-500"}`}>{fmt(r.excessGross)}</td>}
                  {activeBm && showNet && <td className={`py-1.5 pl-2 text-right font-semibold ${r.excessNet > 0 ? "text-emerald-600" : r.excessNet < 0 ? "text-red-500" : "text-gray-500"}`}>{fmt(r.excessNet)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Calendar year returns ── */}
      {calendarYears.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Calendar Year Returns</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-1.5 pr-3 text-left font-semibold text-gray-600">Year</th>
                  {showGross && <th className="py-1.5 px-2 text-right font-semibold text-gray-600">Gross</th>}
                  {showNet && <th className="py-1.5 px-2 text-right font-semibold text-gray-600">Net</th>}
                  {activeBm && <th className="py-1.5 px-2 text-right font-semibold text-gray-600">{activeBm.name}</th>}
                  {activeBm && showGross && <th className="py-1.5 pl-2 text-right font-semibold text-gray-600">Excess (G)</th>}
                  {activeBm && showNet && <th className="py-1.5 pl-2 text-right font-semibold text-gray-600">Excess (N)</th>}
                </tr>
              </thead>
              <tbody>
                {calendarYears.map((r) => (
                  <tr key={r.year} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-gray-700 font-medium">{r.year}</td>
                    {showGross && <td className={`py-1.5 px-2 text-right font-semibold ${r.gross > 0 ? "text-emerald-600" : r.gross < 0 ? "text-red-500" : "text-gray-600"}`}>{fmt(r.gross)}</td>}
                    {showNet && <td className={`py-1.5 px-2 text-right font-semibold ${r.net > 0 ? "text-emerald-600" : r.net < 0 ? "text-red-500" : "text-gray-600"}`}>{fmt(r.net)}</td>}
                    {activeBm && <td className={`py-1.5 px-2 text-right ${r.benchmark > 0 ? "text-emerald-600" : r.benchmark < 0 ? "text-red-500" : "text-gray-500"}`}>{fmt(r.benchmark)}</td>}
                    {activeBm && showGross && <td className={`py-1.5 pl-2 text-right font-semibold ${r.excessGross > 0 ? "text-emerald-600" : r.excessGross < 0 ? "text-red-500" : "text-gray-500"}`}>{fmt(r.excessGross)}</td>}
                    {activeBm && showNet && <td className={`py-1.5 pl-2 text-right font-semibold ${r.excessNet > 0 ? "text-emerald-600" : r.excessNet < 0 ? "text-red-500" : "text-gray-500"}`}>{fmt(r.excessNet)}</td>}
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