import React, { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Search, X, ChevronDown, ChevronUp, BarChart2, LayoutList, Link2, CalendarDays, RefreshCw,
  Play, CheckCircle, Pencil, Trash2, Eye, EyeOff, Plus
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnalysisResults from "./AnalysisResults";

// ── helpers ──────────────────────────────────────────────────────────────────

const ym = (d) => (d ? d.slice(0, 7) : "");
const isMDYFormat = (str) => str && typeof str === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(str);
const formatMDY = (ymStr) => {
  if (!ymStr) return "";
  if (isMDYFormat(ymStr)) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
};
const toMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  if (isMDYFormat(ymStr)) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
};
const getPriorMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  if (isMDYFormat(ymStr)) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  let priorYear = year, priorMonth = month - 1;
  if (priorMonth === 0) { priorMonth = 12; priorYear = year - 1; }
  const lastDay = new Date(priorYear, priorMonth, 0).getDate();
  return `${String(priorMonth).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${priorYear}`;
};
const cleanDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("undefined")) {
    const parts = dateStr.split("/").filter(p => p !== "undefined" && p !== "");
    if (parts.length === 3) return parts.join("/");
    return "";
  }
  return dateStr;
};

const DateRangeTooltip = ({ period, children }) => {
  if (!period) return children;
  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {formatMDY(period.start)} – {formatMDY(period.end)}
      </div>
    </div>
  );
};

function commonPeriod(productConfigs, allProducts, allBenchmarks, allSeries) {
  const starts = [], ends = [];
  for (const cfg of productConfigs) {
    const series = allSeries.filter((s) => s.product_id === cfg.product_id);
    const mr = series.flatMap((s) => s.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (mr.length) { starts.push(ym(mr[0].date)); ends.push(ym(mr[mr.length - 1].date)); }
    const bmIds = cfg.benchmark_ids ?? (cfg.benchmark_id ? [cfg.benchmark_id] : []);
    for (const bmId of bmIds) {
      const bm = allBenchmarks.find((b) => b.id === bmId);
      const bmr = (bm?.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
      if (bmr.length) { starts.push(ym(bmr[0].date)); ends.push(ym(bmr[bmr.length - 1].date)); }
    }
  }
  if (!starts.length) return { start: "", end: "" };
  return { start: starts.sort().pop(), end: ends.sort()[0] };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MEASUREMENT_CATEGORIES = [
  { value: "performance", label: "Performance", attributes: ["Return","Cumulative Return","Excess Return","Cumulative Excess Return","Excess Return Geometric","Average Return","Average Positive Return","Average Negative Return","Growth of $100","Best Period","Worst Period","Number of Consecutive Periods","Number of Consecutive Negative Periods","Down Period Percent","Up Period Percent","Percent Profitable Period","Manager Consistency","Number of Observations","Periods Above the Benchmark","Percentage Above the Benchmark"] },
  { value: "risk", label: "Risk and Regression", attributes: ["Standard Deviation","Downside Deviation","Variance","Skewness","Kurtosis","Information Ratio","Sharpe Ratio","Sortino Ratio","Beta","Alpha","R-Squared","Tracking Error","Treynor Ratio"] },
  { value: "efficiency", label: "Efficiency", attributes: ["Efficiency Ratio","Calmar Ratio","Sterling Ratio","Burke Ratio","Pain Index","Pain Ratio"] },
  { value: "valueAtRisk", label: "Value at Risk", attributes: ["Value at Risk (VaR)","Conditional VaR (CVaR)","Maximum Drawdown","Average Drawdown","Drawdown Duration","Recovery Factor"] },
  { value: "population", label: "Population Calculations", attributes: ["Population Variance","Population Standard Deviation","Population Skewness","Population Kurtosis"] },
];

const TRAILING_OPTIONS = [
  { value: "1M", label: "Trailing 1 Month" },
  { value: "3M", label: "Trailing 3 Months" },
  { value: "QTD", label: "QTD" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1 Year" },
  { value: "2Y", label: "2 Years" },
  { value: "3Y", label: "3 Years" },
  { value: "4Y", label: "4 Years" },
  { value: "5Y", label: "5 Years" },
  { value: "7Y", label: "7 Years" },
  { value: "10Y", label: "10 Years" },
  { value: "since_inception", label: "Since Inception" },
  { value: "custom", label: "Custom Period" },
];

const ROLLING_OPTIONS = [
  { value: "1M", label: "Rolling 1 Month" },
  { value: "2M", label: "Rolling 2 Months" },
  { value: "3M", label: "Rolling 3 Months" },
  { value: "6M", label: "Rolling 6 Months" },
  { value: "1Y", label: "Rolling 1 Year" },
  { value: "3Y", label: "Rolling 3 Years" },
  { value: "5Y", label: "Rolling 5 Years" },
  { value: "10Y", label: "Rolling 10 Years" },
  { value: "custom", label: "Custom Period" },
];

const HISTORICAL_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annual" },
];

const PERIOD_TYPES = [
  { value: "trailing", label: "Trailing Period" },
  { value: "rolling", label: "Rolling Period" },
  { value: "cumulative", label: "Cumulative Period" },
  { value: "calendar", label: "Calendar Year Period" },
  { value: "historical", label: "Historical Return Period" },
];

const emptyPeriodConfig = () => ({
  trailing: [],
  trailing_custom_periods: [],  // array of { start, end, label }
  rolling: [],
  rolling_custom_periods: [],   // array of { start, end, label }
  cumulative: false,
  calendar_years: [],
  calendar_include_ctd: false,
  historical: [],
});

const emptyBenchmarkConfig = () => ({
  show_default: true,
  secondary_benchmark_ids: [],
});

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProductSearchDropdown({ products, selectedIds, onToggle, multi, allSeries }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const sorted = useMemo(() =>
    [...products].sort((a, b) => {
      const fa = (a.firm_name || "").toLowerCase(), fb = (b.firm_name || "").toLowerCase();
      if (fa !== fb) return fa.localeCompare(fb);
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }), [products]);
  const filtered = sorted.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.firm_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const getProductPeriod = (productId) => {
    const series = allSeries.filter((s) => s.product_id === productId);
    const mr = series.flatMap((s) => s.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (mr.length === 0) return null;
    return { start: ym(mr[0].date), end: ym(mr[mr.length - 1].date) };
  };
  const selectedProduct = products.find((p) => p.id === selectedIds[0]);
  const selectedProductPeriod = selectedProduct ? getProductPeriod(selectedProduct.id) : null;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {!multi && selectedIds.length === 1 && selectedProduct && (
        <div className="px-3 py-2.5 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{selectedProduct.name}</p>
              {selectedProductPeriod && (
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  {formatMDY(selectedProductPeriod.start)} – {formatMDY(selectedProductPeriod.end)}
                </span>
              )}
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(selectedProduct.id); }}
              className="text-gray-400 hover:text-red-500 flex-shrink-0" title="Remove product">
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedProduct.firm_name && <p className="text-xs text-gray-500 mt-0.5">{selectedProduct.firm_name}</p>}
        </div>
      )}
      <div className="p-2 border-b border-gray-100 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or firm…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
        </div>
      </div>
      <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No products found</p>
        ) : filtered.map((p) => {
          const checked = selectedIds.includes(p.id);
          const period = getProductPeriod(p.id);
          return (
            <button key={p.id} type="button" onClick={() => onToggle(p.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs hover:bg-gray-50 transition-colors ${checked ? "bg-indigo-50" : ""}`}>
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                {checked && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <div className="min-w-0 flex-1">
                <DateRangeTooltip period={period}><p className="font-medium text-gray-800 truncate">{p.name}</p></DateRangeTooltip>
                {p.firm_name && <p className="text-gray-400 truncate">{p.firm_name}</p>}
              </div>
              {period && <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{formatMDY(period.start)} – {formatMDY(period.end)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TogBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
      {children}
    </button>
  );
}

// Multi-custom period list for trailing/rolling
function CustomPeriodsEditor({ periods, onChange }) {
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const addPeriod = () => {
    if (!newStart || !newEnd) return;
    const label = `${newStart} – ${newEnd}`;
    onChange([...periods, { start: newStart, end: newEnd, label }]);
    setNewStart("");
    setNewEnd("");
  };

  const removePeriod = (idx) => onChange(periods.filter((_, i) => i !== idx));

  return (
    <div className="mt-2 space-y-2">
      {periods.length > 0 && (
        <div className="space-y-1">
          {periods.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs">
              <span className="text-indigo-700 font-medium">{p.start} – {p.end}</span>
              <button type="button" onClick={() => removePeriod(idx)} className="text-gray-400 hover:text-red-500 ml-2">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg flex-wrap">
        <div>
          <input type="text" value={newStart} onChange={e => setNewStart(e.target.value)}
            placeholder="MM/DD/YYYY"
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Start Date</p>
        </div>
        <span className="text-xs text-gray-400 pb-4">to</span>
        <div>
          <input type="text" value={newEnd} onChange={e => setNewEnd(e.target.value)}
            placeholder="MM/DD/YYYY"
            className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">End Date</p>
        </div>
        <button type="button" onClick={addPeriod} disabled={!newStart || !newEnd}
          className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors mb-0.5">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// Inline period configuration component used in the measurement_periods step
function PeriodConfigPanel({ periodConfig, setPeriodConfig, periodStart, periodEnd }) {
  const [expanded, setExpanded] = useState({ trailing: true, rolling: false, cumulative: false, calendar: false, historical: false });
  const toggle = (type) => setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  const toggleArr = (field, val) => setPeriodConfig(prev => {
    const cur = prev[field] || [];
    return { ...prev, [field]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] };
  });

  const availableYears = useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    const parseMDY = (mdy) => { const [m, d, y] = mdy.split("/").map(Number); return new Date(y, m - 1, d); };
    const start = parseMDY(periodStart), end = parseMDY(periodEnd);
    const years = [];
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.push(y);
    return years;
  }, [periodStart, periodEnd]);

  const SectionHeader = ({ type, label, badge }) => (
    <button type="button" onClick={() => toggle(type)}
      className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        {badge > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{badge} selected</span>}
        {badge === true && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">On</span>}
      </div>
      {expanded[type] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Trailing */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="trailing" label="Trailing Period" badge={(periodConfig.trailing || []).length} />
        {expanded.trailing && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex flex-wrap gap-2">
              {TRAILING_OPTIONS.filter(o => o.value !== "custom").map(({ value, label }) => (
                <TogBtn key={value} active={(periodConfig.trailing || []).includes(value)}
                  onClick={() => toggleArr("trailing", value)}>{label}</TogBtn>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Custom Periods</p>
              <CustomPeriodsEditor
                periods={periodConfig.trailing_custom_periods || []}
                onChange={(val) => setPeriodConfig(prev => ({ ...prev, trailing_custom_periods: val }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rolling */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="rolling" label="Rolling Period" badge={(periodConfig.rolling || []).length} />
        {expanded.rolling && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex flex-wrap gap-2">
              {ROLLING_OPTIONS.filter(o => o.value !== "custom").map(({ value, label }) => (
                <TogBtn key={value} active={(periodConfig.rolling || []).includes(value)}
                  onClick={() => toggleArr("rolling", value)}>{label}</TogBtn>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Custom Periods</p>
              <CustomPeriodsEditor
                periods={periodConfig.rolling_custom_periods || []}
                onChange={(val) => setPeriodConfig(prev => ({ ...prev, rolling_custom_periods: val }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cumulative */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="cumulative" label="Cumulative Period" badge={periodConfig.cumulative ? true : 0} />
        {expanded.cumulative && (
          <div className="p-4 border-t border-gray-200">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!periodConfig.cumulative}
                onChange={(e) => setPeriodConfig(prev => ({ ...prev, cumulative: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600" />
              Show cumulative result over analysis period
            </label>
          </div>
        )}
      </div>

      {/* Calendar Year */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="calendar" label="Calendar Year Period" badge={(periodConfig.calendar_years || []).length} />
        {expanded.calendar && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            {availableYears.length > 0 ? (
              <>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setPeriodConfig(prev => ({ ...prev, calendar_years: availableYears }))}
                    className="text-xs text-indigo-600 hover:underline font-medium">Select All</button>
                  <button type="button" onClick={() => setPeriodConfig(prev => ({ ...prev, calendar_years: [] }))}
                    className="text-xs text-gray-500 hover:underline font-medium">Clear All</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <TogBtn key={year} active={(periodConfig.calendar_years || []).includes(year)}
                      onClick={() => toggleArr("calendar_years", year)}>{year}</TogBtn>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-1">
                  <input type="checkbox" checked={!!periodConfig.calendar_include_ctd}
                    onChange={(e) => setPeriodConfig(prev => ({ ...prev, calendar_include_ctd: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600" />
                  Include Calendar-to-Date (CTD)
                </label>
              </>
            ) : (
              <p className="text-xs text-gray-400">Set analysis period first to see available calendar years.</p>
            )}
          </div>
        )}
      </div>

      {/* Historical */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader type="historical" label="Historical Return Period" badge={(periodConfig.historical || []).length} />
        {expanded.historical && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {HISTORICAL_OPTIONS.map(({ value, label }) => (
                <TogBtn key={value} active={(periodConfig.historical || []).includes(value)}
                  onClick={() => toggleArr("historical", value)}>{label}</TogBtn>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Benchmark settings panel
function BenchmarkConfigPanel({ benchmarkConfig, setBenchmarkConfig, benchmarks, productBenchmarkIds }) {
  const defaultBenchmarks = benchmarks.filter(b => productBenchmarkIds.includes(b.id));
  const otherBenchmarks = benchmarks.filter(b => !productBenchmarkIds.includes(b.id));
  const allAvailable = [...otherBenchmarks];

  return (
    <div className="space-y-4">
      {/* Default benchmark toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div>
          <p className="text-sm font-semibold text-gray-700">Show Default Benchmark</p>
          {defaultBenchmarks.length > 0 ? (
            <p className="text-xs text-gray-400 mt-0.5">{defaultBenchmarks.map(b => b.name).join(", ")}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">No default benchmark assigned to product</p>
          )}
        </div>
        <button type="button"
          onClick={() => setBenchmarkConfig(prev => ({ ...prev, show_default: !prev.show_default }))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${benchmarkConfig.show_default ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400"}`}>
          {benchmarkConfig.show_default ? <><Eye className="w-3.5 h-3.5" /> Showing</> : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>}
        </button>
      </div>

      {/* Secondary benchmark */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
          Secondary Benchmark <span className="text-gray-400 font-normal normal-case">(optional)</span>
        </label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2">
          {benchmarks.length === 0 ? (
            <p className="text-xs text-gray-400 p-2 text-center">No benchmarks available</p>
          ) : benchmarks.map((bm) => {
            const isDefault = productBenchmarkIds.includes(bm.id);
            const selected = (benchmarkConfig.secondary_benchmark_ids || []).includes(bm.id);
            return (
              <button key={bm.id} type="button"
                onClick={() => {
                  setBenchmarkConfig(prev => {
                    const cur = prev.secondary_benchmark_ids || [];
                    return { ...prev, secondary_benchmark_ids: cur.includes(bm.id) ? cur.filter(x => x !== bm.id) : [...cur, bm.id] };
                  });
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${selected ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-50 border border-transparent"}`}>
                <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${selected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                  {selected && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span className="flex-1 text-gray-700 font-medium">{bm.name}</span>
                {isDefault && <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">Default</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── AnalysisResultsStep ───────────────────────────────────────────────────────

function AnalysisResultsStep({ analysis, benchmarks, allSeries, onClose }) {
  return (
    <div className="space-y-4 mt-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-700">Analysis saved — showing results</span>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>
      <AnalysisResults
        analysis={analysis}
        products={[]}
        benchmarks={benchmarks}
        returnSeries={allSeries}
      />
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export default function NewAnalysisDialog({ open, onOpenChange, onSaved, onProductClick, onBenchmarkClick }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState("meta");
  const [measurementCategories, setMeasurementCategories] = useState([]);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState(null);
  const [savedAnalysis, setSavedAnalysis] = useState(null);

  // Meta
  const [analysisName, setAnalysisName] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [visibility, setVisibility] = useState("personal");
  const [analysisType, setAnalysisType] = useState("single");

  // Products
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productConfigs, setProductConfigs] = useState({});

  // Period
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  // Current category being configured
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [periodConfig, setPeriodConfig] = useState(emptyPeriodConfig());
  const [benchmarkConfig, setBenchmarkConfig] = useState(emptyBenchmarkConfig());

  useEffect(() => { if (open) resetForm(); }, [open]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-created_date"),
  });
  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks-all"],
    queryFn: () => base44.entities.Benchmark.list(),
  });
  const { data: allSeries = [] } = useQuery({
    queryKey: ["return-series-all"],
    queryFn: () => base44.entities.ReturnSeries.list(),
    enabled: open,
  });

  const activeProducts = products.filter((p) => !p.deleted_at);

  const addProduct = (id) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(id)) return prev;
      const product = activeProducts.find((p) => p.id === id);
      const productBms = product?.inv_desc_benchmarks ?? [];
      const defaultBmIds = productBms.map((b) => (typeof b === "object" ? b.id : b)).filter(Boolean);
      setProductConfigs((prev2) => ({
        ...prev2,
        [id]: { benchmark_ids: defaultBmIds, return_type: "gross", include_clone_product: false, include_clone_benchmark: false },
      }));
      return [...prev, id];
    });
  };
  const removeProduct = (id) => {
    setSelectedProductIds((prev) => prev.filter((x) => x !== id));
    setProductConfigs((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };
  const toggleProduct = (id) => { if (selectedProductIds.includes(id)) removeProduct(id); else addProduct(id); };
  const updateConfig = (productId, key, value) => {
    setProductConfigs((prev) => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }));
  };

  useEffect(() => {
    selectedProductIds.forEach((id) => {
      if (!productConfigs[id]?.benchmark_ids?.length) {
        const product = activeProducts.find((p) => p.id === id);
        const defaultBmIds = (product?.inv_desc_benchmarks ?? []).map((b) => (typeof b === "object" ? b.id : b)).filter(Boolean);
        if (defaultBmIds.length) updateConfig(id, "benchmark_ids", defaultBmIds);
      }
    });
  }, [benchmarks, selectedProductIds]);

  useEffect(() => {
    if (selectedProductIds.length > 0 && !periodStart && !periodEnd) {
      const { start, end } = commonPeriod(
        selectedProductIds.map((id) => ({ product_id: id, ...productConfigs[id] })),
        activeProducts, benchmarks, allSeries
      );
      if (start && end) { setPeriodStart(getPriorMonthEnd(start)); setPeriodEnd(toMonthEnd(end)); }
    }
  }, [selectedProductIds, productConfigs, benchmarks, allSeries]);

  const handleCommonPeriod = () => {
    const { start, end } = commonPeriod(
      selectedProductIds.map((id) => ({ product_id: id, ...productConfigs[id] })),
      activeProducts, benchmarks, allSeries
    );
    setPeriodStart(getPriorMonthEnd(start));
    setPeriodEnd(toMonthEnd(end));
  };

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Analysis.create(data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      if (onSaved) onSaved(saved);
      setSavedAnalysis(saved);
      setStep("saved");
    },
  });

  const resetForm = () => {
    setStep("meta");
    setMeasurementCategories([]);
    setEditingCategoryIndex(null);
    setSavedAnalysis(null);
    setAnalysisName("");
    setIsTemplate(false);
    setVisibility("personal");
    setAnalysisType("single");
    setSelectedProductIds([]);
    setProductConfigs({});
    setPeriodStart("");
    setPeriodEnd("");
    setSelectedCategory("");
    setSelectedAttributes([]);
    setPeriodConfig(emptyPeriodConfig());
    setBenchmarkConfig(emptyBenchmarkConfig());
  };

  const handleSave = () => {
    const data = {
      name: analysisName,
      is_template: isTemplate,
      visibility,
      analysis_type: analysisType,
      product_configs: selectedProductIds.map((id) => {
        const cfg = productConfigs[id] ?? {};
        const product = activeProducts.find((p) => p.id === id);
        const bmIds = cfg.benchmark_ids ?? [];
        return {
          product_id: id,
          product_name: product?.name ?? "",
          firm_name: product?.firm_name ?? "",
          benchmark_ids: bmIds,
          benchmark_names: bmIds.map((bmId) => benchmarks.find((b) => b.id === bmId)?.name ?? ""),
          return_type: cfg.return_type ?? "gross",
          include_clone_product: cfg.include_clone_product ?? false,
          include_clone_benchmark: cfg.include_clone_benchmark ?? false,
        };
      }),
      period_start: cleanDate(periodStart) || "",
      period_end: cleanDate(periodEnd) || "",
      use_common_period: false,
      created_by_id: user?.id ?? "",
      categories_config: measurementCategories,
      measurement_type: {
        selected_types: measurementCategories.map(c => c.category),
        attributes: measurementCategories.flatMap(c => c.attributes ?? []),
        view_mode: "chart",
      },
    };
    saveMutation.mutate(data);
  };

  // Get default benchmark IDs for the currently selected products
  const defaultBmIds = useMemo(() => {
    const ids = new Set();
    selectedProductIds.forEach(id => {
      (productConfigs[id]?.benchmark_ids ?? []).forEach(bmId => ids.add(bmId));
    });
    return Array.from(ids);
  }, [selectedProductIds, productConfigs]);

  const addMeasurementCategory = () => {
    const entry = {
      category: selectedCategory,
      attributes: selectedAttributes,
      periodConfig,
      benchmarkConfig,
      // Summarize periods for display
      periods: [
        ...(periodConfig.trailing?.length || periodConfig.trailing_custom_periods?.length ? ["trailing"] : []),
        ...(periodConfig.rolling?.length || periodConfig.rolling_custom_periods?.length ? ["rolling"] : []),
        ...(periodConfig.cumulative ? ["cumulative"] : []),
        ...(periodConfig.calendar_years?.length ? ["calendar"] : []),
        ...(periodConfig.historical?.length ? ["historical"] : []),
      ],
    };
    if (editingCategoryIndex !== null) {
      setMeasurementCategories((prev) => prev.map((c, i) => i === editingCategoryIndex ? entry : c));
      setEditingCategoryIndex(null);
    } else {
      setMeasurementCategories((prev) => [...prev, entry]);
    }
    setSelectedCategory("");
    setSelectedAttributes([]);
    setPeriodConfig(emptyPeriodConfig());
    setBenchmarkConfig(emptyBenchmarkConfig());
  };

  const startEditCategory = (idx) => {
    const cat = measurementCategories[idx];
    setEditingCategoryIndex(idx);
    setSelectedCategory(cat.category);
    setSelectedAttributes(cat.attributes ?? []);
    setPeriodConfig(cat.periodConfig ?? emptyPeriodConfig());
    setBenchmarkConfig(cat.benchmarkConfig ?? emptyBenchmarkConfig());
    setStep("measurement_attributes");
  };

  const deleteCategory = (idx) => {
    setMeasurementCategories((prev) => prev.filter((_, i) => i !== idx));
  };

  // Period config validity: at least one period type selected
  const hasPeriodSelected = (periodConfig.trailing?.length > 0) ||
    (periodConfig.trailing_custom_periods?.length > 0) ||
    (periodConfig.rolling?.length > 0) ||
    (periodConfig.rolling_custom_periods?.length > 0) ||
    periodConfig.cumulative ||
    (periodConfig.calendar_years?.length > 0) ||
    (periodConfig.historical?.length > 0);

  const canProceedMeta = analysisName.trim() && analysisType;
  const canProceedProducts = selectedProductIds.length > 0;
  const canProceedPeriod = periodStart && periodEnd;
  const canProceedMeasurementType = selectedCategory !== "";
  const canProceedAttributes = selectedAttributes.length > 0;
  const canProceedPeriodConfig = hasPeriodSelected;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
            New Analysis
            {isTemplate && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Template</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Meta ── */}
        {step === "meta" && (
          <div className="space-y-5 mt-1">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Analysis Name</label>
              <input autoFocus value={analysisName} onChange={(e) => setAnalysisName(e.target.value)}
                placeholder="e.g. Q2 2026 Manager Review"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Analysis Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: false, label: "Standard Analysis", desc: "A one-time analysis with fixed product, benchmark & period" },
                  { key: true, label: "Template", desc: "Reusable — product, benchmark & period can be changed each time" },
                ].map(({ key, label, desc }) => (
                  <button key={String(key)} type="button" onClick={() => setIsTemplate(key)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${isTemplate === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <p className={`text-sm font-semibold ${isTemplate === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Visibility</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "personal", label: "Personal", desc: "Only you can view, edit, or delete" },
                  { key: "firm", label: "Firm", desc: "Anyone can view & edit; only you can delete" },
                ].map(({ key, label, desc }) => (
                  <button key={key} type="button" onClick={() => setVisibility(key)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors ${visibility === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <p className={`text-sm font-semibold ${visibility === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Analysis Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "single", icon: <BarChart2 className="w-4 h-4" />, label: "Single Product", desc: "Analyze one product in depth" },
                  { key: "multiple", icon: <LayoutList className="w-4 h-4" />, label: "Multiple Products", desc: "Compare several products side-by-side" },
                ].map(({ key, icon, label, desc }) => (
                  <button key={key} type="button" onClick={() => setAnalysisType(key)}
                    className={`text-left p-3 rounded-xl border-2 transition-colors flex gap-3 items-start ${analysisType === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <span className={`mt-0.5 ${analysisType === key ? "text-indigo-600" : "text-gray-400"}`}>{icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${analysisType === key ? "text-indigo-700" : "text-gray-700"}`}>{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button type="button" onClick={() => setStep("products")} disabled={!canProceedMeta}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Products ── */}
        {step === "products" && (
          <div className="space-y-6 mt-1">
            <button type="button" onClick={() => setStep("meta")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                {analysisType === "single" ? "Select Product" : "Select Products"}
              </label>
              <ProductSearchDropdown
                products={activeProducts}
                selectedIds={selectedProductIds}
                onToggle={analysisType === "single"
                  ? (id) => { setSelectedProductIds([]); setProductConfigs({}); setTimeout(() => addProduct(id), 0); }
                  : toggleProduct}
                multi={analysisType === "multiple"}
                allSeries={allSeries}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("meta")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button type="button" onClick={() => setStep("period")} disabled={!canProceedProducts}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Period ── */}
        {step === "period" && (
          <div className="space-y-6 mt-1">
            <button type="button" onClick={() => setStep("products")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Analysis Period</label>
                <button type="button" onClick={handleCommonPeriod}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Common Period
                </button>
              </div>
              <div className="flex items-start gap-4 flex-wrap">
                <div>
                  <input type="text" value={periodStart || ""}
                    onChange={(e) => { const val = e.target.value; if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") setPeriodStart(val); }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
                  <p className="text-xs text-gray-500 mt-1 font-medium">Start Date</p>
                </div>
                <span className="text-xs text-gray-400 mt-2">to</span>
                <div>
                  <input type="text" value={periodEnd || ""}
                    onChange={(e) => { const val = e.target.value; if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") setPeriodEnd(val); }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
                  <p className="text-xs text-gray-500 mt-1 font-medium">End Date</p>
                </div>
                {(periodStart || periodEnd) && (
                  <button type="button" onClick={() => { setPeriodStart(""); setPeriodEnd(""); }}
                    className="text-xs text-gray-400 hover:text-indigo-600 hover:underline mt-2">Clear</button>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("products")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button type="button" onClick={() => setStep("measurement_type")} disabled={!canProceedPeriod}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Measurement Type (category picker) ── */}
        {step === "measurement_type" && (
          <div className="space-y-6 mt-1">
            <button type="button" onClick={() => setStep("period")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Select Measurement Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a measurement category..." />
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_CATEGORIES.map((cat) => {
                    const alreadyAdded = measurementCategories.some((c, i) => c.category === cat.value && i !== editingCategoryIndex);
                    return (
                      <SelectItem key={cat.value} value={cat.value} disabled={alreadyAdded}>
                        {cat.label}{alreadyAdded ? " (added)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {measurementCategories.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selected Categories</label>
                {measurementCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="flex-1">{MEASUREMENT_CATEGORIES.find(c => c.value === cat.category)?.label}</span>
                    <span className="text-gray-400 text-xs">({cat.attributes?.length ?? 0} attrs · {cat.periods?.length ?? 0} period types)</span>
                    <button type="button" onClick={() => startEditCategory(idx)}
                      className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deleteCategory(idx)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("period")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              {measurementCategories.length > 0 && (
                <button type="button" onClick={() => setStep("review")}
                  className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
                  Finish & Review
                </button>
              )}
              <button type="button" onClick={() => setStep("measurement_attributes")} disabled={!canProceedMeasurementType}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Attributes ── */}
        {step === "measurement_attributes" && (() => {
          const cat = MEASUREMENT_CATEGORIES.find(c => c.value === selectedCategory);
          const toggleAttr = (attr) => setSelectedAttributes(prev =>
            prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
          );
          return (
            <div className="space-y-6 mt-1">
              <button type="button" onClick={() => setStep("measurement_type")} className="text-xs text-indigo-600 hover:underline">← Back</button>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {editingCategoryIndex !== null ? "Edit Attributes for" : "Select Attributes for"} {cat?.label}
                  </label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setSelectedAttributes(cat?.attributes ?? [])} className="text-xs text-indigo-600 hover:underline">Select All</button>
                    <button type="button" onClick={() => setSelectedAttributes([])} className="text-xs text-gray-400 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(cat?.attributes ?? []).map((attr) => (
                    <button key={attr} type="button" onClick={() => toggleAttr(attr)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedAttributes.includes(attr) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                      {attr}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setStep("measurement_type")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="button" onClick={() => setStep("measurement_periods")} disabled={!canProceedAttributes}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Period Config (detailed) ── */}
        {step === "measurement_periods" && (
          <div className="space-y-5 mt-1">
            <button type="button" onClick={() => setStep("measurement_attributes")} className="text-xs text-indigo-600 hover:underline">← Back</button>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">
                Select Periods for {MEASUREMENT_CATEGORIES.find(c => c.value === selectedCategory)?.label}
              </label>
              <PeriodConfigPanel
                periodConfig={periodConfig}
                setPeriodConfig={setPeriodConfig}
                periodStart={periodStart}
                periodEnd={periodEnd}
              />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">Benchmark Settings</label>
              <BenchmarkConfigPanel
                benchmarkConfig={benchmarkConfig}
                setBenchmarkConfig={setBenchmarkConfig}
                benchmarks={benchmarks}
                productBenchmarkIds={defaultBmIds}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("measurement_type")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button type="button"
                onClick={() => { addMeasurementCategory(); setStep("measurement_type"); }}
                disabled={!canProceedPeriodConfig}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                {editingCategoryIndex !== null ? "Update Category" : measurementCategories.length > 0 ? "Add Another Category" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* ── Review ── */}
        {step === "review" && (
          <div className="space-y-6 mt-1">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Analysis Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="text-gray-800 font-medium">{analysisName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Products:</span>
                  <span className="text-gray-800 font-medium">{selectedProductIds.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Period:</span>
                  <span className="text-gray-800 font-medium">{periodStart} to {periodEnd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Measurement Categories:</span>
                  <span className="text-gray-800 font-medium">{measurementCategories.length}</span>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {measurementCategories.map((cat, idx) => {
                  const label = MEASUREMENT_CATEGORIES.find(c => c.value === cat.category)?.label;
                  const pc = cat.periodConfig || {};
                  const trailingCount = (pc.trailing || []).length + (pc.trailing_custom_periods || []).length;
                  const rollingCount = (pc.rolling || []).length + (pc.rolling_custom_periods || []).length;
                  const historicalCount = (pc.historical || []).length;
                  const calCount = (pc.calendar_years || []).length;
                  const parts = [
                    trailingCount > 0 && `${trailingCount} trailing`,
                    rollingCount > 0 && `${rollingCount} rolling`,
                    pc.cumulative && "cumulative",
                    calCount > 0 && `${calCount} cal. years`,
                    historicalCount > 0 && `${historicalCount} historical`,
                  ].filter(Boolean).join(", ");
                  return (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-700">{label}</span>
                        {parts && <span className="text-gray-400 ml-1">· {parts}</span>}
                        <span className="text-gray-400 ml-1">· {cat.attributes?.length ?? 0} attrs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStep("measurement_type")} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">← Back</button>
              <button type="button" onClick={handleSave} disabled={saveMutation.isPending}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                {saveMutation.isPending ? "Saving..." : "Save & Process →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Saved / Results ── */}
        {step === "saved" && savedAnalysis && (
          <AnalysisResultsStep
            analysis={savedAnalysis}
            benchmarks={benchmarks}
            allSeries={allSeries}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}