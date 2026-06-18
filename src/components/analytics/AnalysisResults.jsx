import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, TrendingUp, LayoutList, ChevronDown, ChevronUp, Download, AlignVerticalJustifyStart, AlignHorizontalJustifyStart, Printer } from "lucide-react";
import { runAnalysis, isRatioMetric, shouldAnnualize } from "./analyticsCalculations";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const CATEGORY_LABELS = {
  performance: "Performance",
  risk: "Risk and Regression",
  efficiency: "Efficiency",
  valueAtRisk: "Value at Risk",
  population: "Population Calculations",
};

const PRODUCT_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16"];
const BM_COLOR = "#94A3B8";

function fmt(val, attribute) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  if (attribute === "Number of Observations") return Math.round(val).toString();
  if (attribute === "Growth of $100") return `$${val.toFixed(2)}`;
  if (attribute === "R-Squared") return `${val.toFixed(2)}%`;
  if (isRatioMetric(attribute)) return val.toFixed(3);
  return `${val.toFixed(2)}%`;
}

function colorClass(val, attribute) {
  if (val === null || val === undefined || isNaN(val)) return "text-gray-400";
  if (attribute === "Number of Observations" || attribute === "Growth of $100") return "text-gray-800";
  return val >= 0 ? "text-green-700" : "text-red-600";
}

function SectionToggle({ label, badge, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700">{label}</span>
          {badge && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function PeriodResultTable({ periodResult, attributes, productName, bmNames, returnType, includeCloneProduct }) {
  const { attributeValues, bmValues, observations } = periodResult;
  const hasBm = !!bmValues;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 w-40">Attribute</th>
            {attributes.map((attr, i) => (
              <th key={attr} className="text-right px-3 py-2 font-semibold text-indigo-700 min-w-[90px]">{attr}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Product row */}
          <tr className="border-b border-gray-100">
            <td className="px-3 py-2 text-gray-600 font-medium">
              {productName}
              {returnType && <span className="text-gray-400 font-normal"> — {returnType.charAt(0).toUpperCase() + returnType.slice(1)} Return</span>}
              {includeCloneProduct && <span className="text-gray-400 font-normal"> (Clone)</span>}
            </td>
            {attributes.map((attr) => {
              const pVal = attributeValues?.[attr];
              return (
                <td key={attr} className={`px-3 py-2 text-right font-semibold ${colorClass(pVal, attr)}`}>{fmt(pVal, attr)}</td>
              );
            })}
          </tr>
          {/* Benchmark row */}
          {hasBm && (
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 text-gray-600 font-medium">{bmNames?.[0] || "Benchmark"}</td>
              {attributes.map((attr) => {
                const bVal = bmValues?.[attr];
                return (
                  <td key={attr} className={`px-3 py-2 text-right font-medium ${colorClass(bVal, attr)}`}>{fmt(bVal, attr)}</td>
                );
              })}
            </tr>
          )}
          {/* Excess row with separator line above */}
          {hasBm && (
            <tr className="border-t-2 border-gray-200">
              <td className="px-3 py-2 text-gray-600 font-semibold text-orange-600">Excess Return</td>
              {attributes.map((attr) => {
                const pVal = attributeValues?.[attr];
                const bVal = bmValues?.[attr];
                const excess = (pVal !== null && pVal !== undefined && bVal !== null && bVal !== undefined) ? pVal - bVal : null;
                return (
                  <td key={attr} className={`px-3 py-2 text-right font-semibold ${colorClass(excess, attr)}`}>{fmt(excess, attr)}</td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
      {observations > 0 && <p className="text-[10px] text-gray-400 px-3 pt-1">n = {observations} monthly observations</p>}
    </div>
  );
}

function HistoricalTable({ periodResult, productName, bmNames }) {
  const { historicalData, bmHistoricalData } = periodResult;
  const hasBm = bmHistoricalData?.length > 0;
  return (
    <div className="overflow-x-auto max-h-64">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500">Period</th>
            <th className="text-right px-3 py-2 font-semibold text-indigo-700">{productName}</th>
            {hasBm && <th className="text-right px-3 py-2 font-semibold text-gray-500">{bmNames?.[0] || "Benchmark"}</th>}
            {hasBm && <th className="text-right px-3 py-2 font-semibold text-orange-600">Excess</th>}
          </tr>
        </thead>
        <tbody>
          {historicalData.map((row, i) => {
            const bmRow = bmHistoricalData?.find(b => b.label === row.label);
            const excess = bmRow ? row.value - bmRow.value : null;
            return (
              <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                <td className="px-3 py-2 text-gray-600 font-medium">{row.label}</td>
                <td className={`px-3 py-2 text-right font-semibold ${colorClass(row.value, "Return")}`}>{fmt(row.value, "Return")}</td>
                {hasBm && <td className={`px-3 py-2 text-right ${colorClass(bmRow?.value, "Return")}`}>{fmt(bmRow?.value, "Return")}</td>}
                {hasBm && <td className={`px-3 py-2 text-right font-semibold ${colorClass(excess, "Return")}`}>{fmt(excess, "Return")}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoricalChart({ periodResult, productName, bmNames, chartType }) {
  const { historicalData, bmHistoricalData } = periodResult;
  const hasBm = bmHistoricalData?.length > 0;
  const data = historicalData.map(row => {
    const bmRow = bmHistoricalData?.find(b => b.label === row.label);
    return { label: row.label, product: row.value, benchmark: bmRow?.value ?? null };
  });
  const ChartComp = chartType === "line" ? LineChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ChartComp data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={v => `${v?.toFixed(1)}%`} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v, name) => [v !== null ? `${v?.toFixed(2)}%` : "—", name]} />
        <Legend />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        {chartType === "line" ? (
          <>
            <Line type="monotone" dataKey="product" name={productName} stroke={PRODUCT_COLORS[0]} strokeWidth={2} dot={{ r: 2 }} />
            {hasBm && <Line type="monotone" dataKey="benchmark" name={bmNames?.[0] || "Benchmark"} stroke={BM_COLOR} strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2 }} />}
          </>
        ) : (
          <>
            <Bar dataKey="product" name={productName} fill={PRODUCT_COLORS[0]}>
              {data.map((entry, i) => <Cell key={i} fill={entry.product >= 0 ? PRODUCT_COLORS[0] : "#EF4444"} />)}
            </Bar>
            {hasBm && <Bar dataKey="benchmark" name={bmNames?.[0] || "Benchmark"} fill={BM_COLOR} />}
          </>
        )}
      </ChartComp>
    </ResponsiveContainer>
  );
}

function RollingChart({ periodResult, attribute, productName, bmNames, chartType }) {
  const { rollingData } = periodResult;
  if (!rollingData?.length) return <p className="text-xs text-gray-400 py-4 text-center">Not enough data for this rolling window.</p>;
  const data = rollingData.map(r => ({ date: r.date?.slice(0, 7), product: r.values?.[attribute] ?? null }));
  const ChartComp = chartType === "line" ? LineChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ChartComp data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis tickFormatter={v => isRatioMetric(attribute) ? v?.toFixed(2) : `${v?.toFixed(1)}%`} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => [fmt(v, attribute), attribute]} />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        {chartType === "line" ? (
          <Line type="monotone" dataKey="product" name={productName} stroke={PRODUCT_COLORS[0]} strokeWidth={1.5} dot={false} />
        ) : (
          <Bar dataKey="product" name={productName}>
            {data.map((d, i) => <Cell key={i} fill={(d.product ?? 0) >= 0 ? PRODUCT_COLORS[0] : "#EF4444"} />)}
          </Bar>
        )}
      </ChartComp>
    </ResponsiveContainer>
  );
}

function GrowthOf100Table({ growthData, bmGrowthData, productName, bmName }) {
  const hasBm = bmGrowthData?.length > 0;
  const formatDate = (ymStr) => {
    if (!ymStr) return "";
    const [year, month] = ymStr.split("-").map(Number);
    // Get last day of month (handles negative months by rolling back years)
    const lastDay = new Date(year, month, 0).getDate();
    return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
  };
  // Build data array with starting $100 base row
  const data = [
    // Starting point row
    {
      date: "Start",
      product: 100,
      benchmark: hasBm ? 100 : null,
      isStartRow: true,
    },
    // Monthly data rows
    ...growthData.map((row, i) => ({
      date: formatDate(row.date),
      product: row.value,
      benchmark: bmGrowthData?.[i]?.value ?? null,
    })) || [],
  ];
  
  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-200">
            <th className="text-left px-3 py-2 font-semibold text-gray-500">Period</th>
            <th className="text-right px-3 py-2 font-semibold text-indigo-700">{productName}</th>
            {hasBm && <th className="text-right px-3 py-2 font-semibold text-gray-500">{bmName || "Benchmark"}</th>}
            {hasBm && <th className="text-right px-3 py-2 font-semibold text-orange-600">Excess</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const excess = row.benchmark !== null && row.benchmark !== undefined ? row.product - row.benchmark : null;
            if (row.isStartRow) {
              return (
                <tr key="start" className="border-b border-gray-200 bg-indigo-50/50 font-semibold">
                  <td className="px-3 py-2 text-gray-700">Start</td>
                  <td className="px-3 py-2 text-right text-indigo-700">$100.00</td>
                  {hasBm && (
                    <>
                      <td className="px-3 py-2 text-right text-gray-600">$100.00</td>
                      <td className="px-3 py-2 text-right text-gray-400">$0.00</td>
                    </>
                  )}
                </tr>
              );
            }
            return (
              <tr key={i} className={`border-b border-gray-100 ${(i - 1) % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                <td className="px-3 py-2 text-gray-600 font-medium">{row.date}</td>
                <td className={`px-3 py-2 text-right font-semibold ${row.product >= 100 ? "text-green-700" : "text-red-600"}`}>
                  ${row.product?.toFixed(2)}
                </td>
                {hasBm && (
                  <>
                    <td className={`px-3 py-2 text-right ${row.benchmark >= 100 ? "text-green-700" : "text-red-600"}`}>
                      ${row.benchmark?.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${excess >= 0 ? "text-green-700" : "text-red-600"}`}>
                      ${excess?.toFixed(2)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GrowthOf100Chart({ growthData, bmGrowthData, productName, bmName }) {
  const hasBm = bmGrowthData?.length > 0;
  
  // Format date to mm/dd/yyyy (month-end)
  const formatDate = (ymStr) => {
    if (!ymStr) return "";
    const [year, month] = ymStr.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
  };
  
  // Build data array with starting $100 point at the first date
  const firstDate = growthData?.[0]?.date || "";
  const data = [
    // Starting point at $100
    {
      date: formatDate(firstDate),
      product: 100,
      benchmark: hasBm ? 100 : null,
      isStartPoint: true,
    },
    // Monthly data points
    ...growthData.map((row, i) => ({
      date: formatDate(row.date),
      product: row.value,
      benchmark: bmGrowthData?.[i]?.value ?? null,
    })) || [],
  ];
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tickFormatter={v => `$${v?.toFixed(0)}`} tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
        <Tooltip formatter={(v, name) => [`$${v?.toFixed(2)}`, name]} />
        <Legend />
        <ReferenceLine y={100} stroke="#6B7280" strokeDasharray="4 2" />
        <Line type="monotone" dataKey="product" name={productName} stroke={PRODUCT_COLORS[0]} strokeWidth={2} dot={false} />
        {hasBm && <Line type="monotone" dataKey="benchmark" name={bmName || "Benchmark"} stroke={BM_COLOR} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

function AttributeBarChart({ periodResults, attribute, productNames, bmNames }) {
  // Build comparison data across non-rolling, non-historical periods
  const comparablePeriods = periodResults.filter(pr => !pr.isRolling && !pr.isHistorical);
  if (!comparablePeriods.length) return null;
  const data = comparablePeriods.map(pr => {
    const entry = { period: pr.window.label, product: pr.attributeValues?.[attribute] ?? null };
    if (pr.bmValues) {
      entry.benchmark = pr.bmValues?.[attribute] ?? null;
      entry.excess = (entry.product != null && entry.benchmark != null) ? entry.product - entry.benchmark : null;
    }
    return entry;
  });
  const hasBm = data.some(d => d.benchmark !== undefined);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={v => isRatioMetric(attribute) ? v?.toFixed(2) : `${v?.toFixed(1)}%`} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v, name) => {
          const isExcess = name === "excess";
          const val = fmt(v, attribute);
          return [<span style={{ color: isExcess && v != null ? (v > 0 ? "#10B981" : "#EF4444") : "inherit" }}>{val}</span>, name];
        }} />
        <Legend />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Bar dataKey="product" name={productNames[0]} fill="#4F46E5" />
        {hasBm && <Bar dataKey="benchmark" name={bmNames?.[0] || "Benchmark"} fill="#94A3B8" />}
        {hasBm && <Bar dataKey="excess" name="Excess Return" fill="#F97316" />}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Horizontal table: attributes as rows, periods as columns
function PeriodResultTableHorizontal({ periodResults, productName, bmNames, returnType, includeCloneProduct }) {
  const standardPeriods = periodResults.filter(pr => !pr.isRolling && !pr.isHistorical);
  if (standardPeriods.length === 0) return null;
  // Collect all unique attributes across all periods (not just the first one)
  const allAttributesSet = new Set();
  standardPeriods.forEach(pr => {
    Object.keys(pr.attributeValues || {}).forEach(attr => allAttributesSet.add(attr));
  });
  const attributes = Array.from(allAttributesSet);
  const hasBm = standardPeriods.some(pr => !!pr.bmValues);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 sticky left-0 bg-gray-50 min-w-[140px]"></th>
            {standardPeriods.map((pr, i) => (
              <th key={i} className="px-3 py-2 font-semibold text-indigo-700 text-center min-w-[90px]">
                {pr.window.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map((attr, attrIdx) => (
            <React.Fragment key={attr}>
              {/* Product row for this attribute */}
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-600 font-medium sticky left-0 bg-white">
                  {attrIdx === 0 ? (
                    <span>
                      {productName}
                      {returnType && <span className="text-gray-400 font-normal"> — {returnType.charAt(0).toUpperCase() + returnType.slice(1)} Return</span>}
                      {includeCloneProduct && <span className="text-gray-400 font-normal"> (Clone)</span>}
                    </span>
                  ) : attr}
                </td>
                {standardPeriods.map((pr, pi) => {
                  const pVal = pr.attributeValues?.[attr];
                  return (
                    <td key={pi} className={`px-3 py-2 text-center font-semibold ${colorClass(pVal, attr)}`}>
                      {fmt(pVal, attr)}
                    </td>
                  );
                })}
              </tr>
              {/* Benchmark row for this attribute */}
              {hasBm && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-600 font-medium sticky left-0 bg-white">{bmNames?.[0] || "Benchmark"}</td>
                  {standardPeriods.map((pr, pi) => {
                    const bVal = pr.bmValues?.[attr];
                    return (
                      <td key={pi} className={`px-3 py-2 text-center ${colorClass(bVal, attr)}`}>
                        {fmt(bVal, attr)}
                      </td>
                    );
                  })}
                </tr>
              )}
              {/* Excess row for this attribute with separator line above */}
              {hasBm && (
                <tr className="border-t-2 border-gray-200">
                  <td className="px-3 py-2 text-gray-600 font-semibold text-orange-600 sticky left-0 bg-white">Excess Return</td>
                  {standardPeriods.map((pr, pi) => {
                    const pVal = pr.attributeValues?.[attr];
                    const bVal = pr.bmValues?.[attr];
                    const excess = (pVal != null && bVal != null) ? pVal - bVal : null;
                    return (
                      <td key={pi} className={`px-3 py-2 text-center font-semibold ${colorClass(excess, attr)}`}>
                        {fmt(excess, attr)}
                      </td>
                    );
                  })}
                </tr>
              )}
              {/* Extra spacing between attributes */}
              {attrIdx < attributes.length - 1 && (
                <tr>
                  <td colSpan={standardPeriods.length + 1} className="h-2"></td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Determine the best default chart type for a given period result
function defaultChartType(pr) {
  if (pr.isRolling) return "line";        // rolling time-series → line
  if (pr.isHistorical) return "bar";      // period-over-period → bar
  return "bar";                           // trailing/calendar/cumulative → bar
}

// Captures a single block + a header summary and saves as a PDF, auto-fitting orientation
async function downloadBlock(el, filename, meta = {}) {
  if (!el) return;
  const origCursor = document.body.style.cursor;
  document.body.style.cursor = 'wait';

  const safe = (v) => v ? String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
  const renderW = 900;

  // Build an off-screen wrapper with no clipping at all
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${renderW}px;overflow:visible;background:#fff;font-family:sans-serif;`;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `padding:16px 20px 12px;border-bottom:2px solid #e5e7eb;width:${renderW}px;box-sizing:border-box;`;
  header.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
      <div>
        <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">${safe(meta.analysisName) || 'Analysis'}</div>
        ${meta.periodLabel ? `<div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:2px;">${safe(meta.periodLabel)}</div>` : ''}
        ${meta.category ? `<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${safe(meta.category)}</div>` : ''}
      </div>
      <div style="text-align:right;flex-shrink:0;">
        ${meta.periodStart && meta.periodEnd ? `<div style="font-size:10px;color:#64748b;margin-bottom:3px;"><b>Period:</b> ${safe(meta.periodStart)} &rarr; ${safe(meta.periodEnd)}</div>` : ''}
        ${meta.productName ? `<div style="font-size:10px;color:#64748b;margin-bottom:3px;"><b>Product:</b> ${safe(meta.productName)}${meta.firmName ? ` (${safe(meta.firmName)})` : ''}${meta.returnType ? ` &middot; ${safe(meta.returnType.charAt(0).toUpperCase()+meta.returnType.slice(1))}` : ''}</div>` : ''}
        ${meta.benchmarkName ? `<div style="font-size:10px;color:#64748b;"><b>Benchmark:</b> ${safe(meta.benchmarkName)}</div>` : ''}
      </div>
    </div>
  `;

  // Clone the content element — no overflow clipping in clone
  const clone = el.cloneNode(true);
  clone.style.cssText = `width:${renderW}px;overflow:visible;`;
  clone.querySelectorAll('*').forEach(d => {
    d.style.overflow = 'visible';
    d.style.overflowX = 'visible';
    d.style.overflowY = 'visible';
    d.style.maxHeight = 'none';
  });
  // Hide the PDF download button in the clone
  clone.querySelectorAll('button').forEach(b => { if (b.title === 'Download as PDF') b.style.display = 'none'; });

  wrapper.appendChild(header);
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Force recharts containers in the clone to fixed width and wait for repaint
    clone.querySelectorAll('.recharts-responsive-container').forEach(svg => {
      svg.style.width = `${renderW}px`;
      svg.style.minWidth = `${renderW}px`;
    });

    await new Promise(r => setTimeout(r, 250));

    const canvas = await html2canvas(wrapper, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      width: renderW, windowWidth: renderW, logging: false,
    });

    document.body.removeChild(wrapper);

    // Choose orientation based on canvas dimensions
    const naturalH = canvas.height / 2;
    const naturalW = canvas.width / 2;
    const orientation = naturalH > naturalW ? 'portrait' : 'landscape';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;

    const fitScale = Math.min(availW / canvas.width, availH / canvas.height);
    const fW = canvas.width * fitScale;
    const fH = canvas.height * fitScale;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - fW) / 2, margin, fW, fH);

    pdf.save(filename);
  } catch (e) {
    console.error(e);
  } finally {
    if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
    document.body.style.cursor = origCursor;
  }
}

// Wraps a pdf-block and injects a floating download button top-right
function PdfBlock({ filename, meta = {}, className = "", children }) {
  const ref = useRef(null);
  return (
    <div ref={ref} className={`pdf-block relative group ${className}`} data-pdf-meta={JSON.stringify(meta)}>
      <button
        onClick={() => downloadBlock(ref.current, filename, meta)}
        title="Download as PDF"
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 bg-white text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-all text-xs shadow-sm"
      >
        <Download className="w-3 h-3" /> PDF
      </button>
      {children}
    </div>
  );
}

export default function AnalysisResults({ analysis, products, benchmarks, returnSeries }) {
  // Initialize viewMode from analysis config, default to "table" if not set
  const savedViewMode = analysis?.measurement_type?.view_mode || "table";
  const [viewMode, setViewMode] = useState(savedViewMode);
  const [chartTypes, setChartTypes] = useState({});
  const [tableOrientation, setTableOrientation] = useState("vertical"); // "vertical" | "horizontal"
  
  // Download/Print handler — cover page first, then each .pdf-block with header + page numbers
  const handleDownload = async () => {
    const allBlocks = Array.from(document.querySelectorAll('.pdf-block'));
    // Filter out the header block (it has no data-pdf-meta product info — it's the UI controls block)
    const contentBlocks = allBlocks.filter(b => {
      try { const m = JSON.parse(b.getAttribute('data-pdf-meta') || '{}'); return !!m.productName; } catch(e) { return false; }
    });
    if (!contentBlocks.length) return;

    document.body.style.cursor = 'wait';
    const safe = (v) => v ? String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
    const renderW = 900;
    const margin = 28;

    // --- Build cover page canvas ---
    // Gather unique products, benchmarks, categories from results
    const coverProductLines = (analysis?.product_configs || []).map(cfg =>
      `${safe(cfg.product_name || '')}${cfg.firm_name ? ` <span style="color:#94a3b8">(${safe(cfg.firm_name)})</span>` : ''}${cfg.return_type ? ` &middot; <span style="color:#6366f1;font-weight:600">${safe(cfg.return_type.charAt(0).toUpperCase()+cfg.return_type.slice(1))}</span>` : ''}`
    );
    const coverBmLines = [...new Set((analysis?.product_configs || []).flatMap(cfg => cfg.benchmark_names || []).filter(Boolean))];
    const coverCategories = (analysis?.categories_config || []).map(c => CATEGORY_LABELS[c.category] || c.category);
    const totalPages = contentBlocks.length + 1; // cover + content pages

    const coverEl = document.createElement('div');
    coverEl.style.cssText = `width:${renderW}px;min-height:500px;background:#fff;font-family:sans-serif;padding:60px 70px;box-sizing:border-box;`;
    coverEl.innerHTML = `
      <div style="border-bottom:3px solid #4f46e5;padding-bottom:24px;margin-bottom:32px;">
        <div style="font-size:28px;font-weight:800;color:#1e293b;line-height:1.2;margin-bottom:8px;">${safe(analysis?.name || 'Analysis')}</div>
        <div style="font-size:13px;color:#64748b;">Generated ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:36px;">
        <div>
          <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Analysis Period</div>
          <div style="font-size:15px;font-weight:600;color:#1e293b;">${safe(analysis?.period_start || '')} → ${safe(analysis?.period_end || '')}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Report Pages</div>
          <div style="font-size:15px;font-weight:600;color:#1e293b;">${contentBlocks.length} section${contentBlocks.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      ${coverProductLines.length ? `
      <div style="margin-bottom:28px;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Product${coverProductLines.length > 1 ? 's' : ''}</div>
        ${coverProductLines.map(p => `<div style="font-size:13px;color:#1e293b;margin-bottom:5px;padding:8px 12px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:0 6px 6px 0;">${p}</div>`).join('')}
      </div>` : ''}
      ${coverBmLines.length ? `
      <div style="margin-bottom:28px;">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Benchmark${coverBmLines.length > 1 ? 's' : ''}</div>
        ${coverBmLines.map(b => `<div style="font-size:13px;color:#1e293b;margin-bottom:5px;padding:8px 12px;background:#f8fafc;border-left:3px solid #94a3b8;border-radius:0 6px 6px 0;">${safe(b)}</div>`).join('')}
      </div>` : ''}
      ${coverCategories.length ? `
      <div>
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Analysis Types Included</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${coverCategories.map(c => `<span style="font-size:12px;font-weight:600;color:#4f46e5;background:#eef2ff;padding:5px 14px;border-radius:20px;border:1px solid #c7d2fe;">${safe(c)}</span>`).join('')}
        </div>
      </div>` : ''}
    `;

    const coverWrapper = document.createElement('div');
    coverWrapper.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${renderW}px;overflow:visible;background:#fff;`;
    coverWrapper.appendChild(coverEl);
    document.body.appendChild(coverWrapper);
    await new Promise(r => setTimeout(r, 200));
    const coverCanvas = await html2canvas(coverWrapper, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff',
      width: renderW, windowWidth: renderW, logging: false,
    });
    document.body.removeChild(coverWrapper);

    // --- Capture content block canvases ---
    const canvases = [];
    for (const block of contentBlocks) {
      const metaStr = block.getAttribute('data-pdf-meta') || '{}';
      let meta = {};
      try { meta = JSON.parse(metaStr); } catch(e) {}

      const headerEl = document.createElement('div');
      headerEl.style.cssText = `padding:14px 20px 10px;border-bottom:2px solid #e5e7eb;width:${renderW}px;box-sizing:border-box;background:#fff;font-family:sans-serif;`;
      headerEl.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:3px;">${safe(meta.analysisName) || 'Analysis'}</div>
            ${meta.periodLabel ? `<div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:2px;">${safe(meta.periodLabel)}</div>` : ''}
            ${meta.category ? `<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${safe(meta.category)}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            ${meta.periodStart && meta.periodEnd ? `<div style="font-size:10px;color:#64748b;margin-bottom:2px;"><b>Period:</b> ${safe(meta.periodStart)} &rarr; ${safe(meta.periodEnd)}</div>` : ''}
            ${meta.productName ? `<div style="font-size:10px;color:#64748b;margin-bottom:2px;"><b>Product:</b> ${safe(meta.productName)}${meta.firmName ? ` (${safe(meta.firmName)})` : ''}${meta.returnType ? ` &middot; ${safe(meta.returnType.charAt(0).toUpperCase()+meta.returnType.slice(1))}` : ''}</div>` : ''}
            ${meta.benchmarkName ? `<div style="font-size:10px;color:#64748b;"><b>Benchmark:</b> ${safe(meta.benchmarkName)}</div>` : ''}
          </div>
        </div>
      `;

      const clone = block.cloneNode(true);
      clone.style.cssText = `width:${renderW}px;overflow:visible;`;
      clone.querySelectorAll('*').forEach(d => {
        d.style.overflow = 'visible'; d.style.overflowX = 'visible';
        d.style.overflowY = 'visible'; d.style.maxHeight = 'none';
      });
      clone.querySelectorAll('button').forEach(b => { b.style.display = 'none'; });
      clone.querySelectorAll('.recharts-responsive-container').forEach(svg => {
        svg.style.width = `${renderW}px`; svg.style.minWidth = `${renderW}px`;
      });

      const wrapper = document.createElement('div');
      wrapper.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${renderW}px;overflow:visible;background:#fff;font-family:sans-serif;`;
      wrapper.appendChild(headerEl);
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      await new Promise(r => setTimeout(r, 250));
      const canvas = await html2canvas(wrapper, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        width: renderW, windowWidth: renderW, logging: false,
      });
      document.body.removeChild(wrapper);
      canvases.push(canvas);
    }

    // --- Assemble PDF ---
    try {
      // Start with portrait cover page
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

      const addCanvasToPage = (canvas, pgW, pgH) => {
        const availW = pgW - margin * 2;
        const availH = pgH - margin * 2;
        const fitScale = Math.min(availW / canvas.width, availH / canvas.height);
        const fW = canvas.width * fitScale;
        const fH = canvas.height * fitScale;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pgW - fW) / 2, margin, fW, fH);
      };

      // Page 1: cover (no page number)
      addCanvasToPage(coverCanvas, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());

      // Subsequent pages: content blocks with page numbers
      canvases.forEach((canvas, i) => {
        const naturalH = canvas.height / 2;
        const naturalW = canvas.width / 2;
        const orientation = naturalH > naturalW ? 'portrait' : 'landscape';
        pdf.addPage('letter', orientation);

        const pgW = pdf.internal.pageSize.getWidth();
        const pgH = pdf.internal.pageSize.getHeight();
        addCanvasToPage(canvas, pgW, pgH);

        // Page number bottom-right: "Page X of Y"
        const pageNum = i + 2; // page 1 is cover
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pgW - margin, pgH - 12, { align: 'right' });
      });

      pdf.save(`${analysis?.name || 'Analysis'}-Results.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const results = useMemo(() => {
    if (!analysis || !returnSeries || !benchmarks) return [];
    return runAnalysis({ analysis, allSeries: returnSeries, allBenchmarks: benchmarks });
  }, [analysis, returnSeries, benchmarks]);

  // Extract includeCloneProduct from analysis product_configs
  const includeCloneProduct = analysis?.product_configs?.[0]?.include_clone_product ?? false;

  const hasAnyData = results.some(r => r.categories?.some(c => c.periodResults?.length > 0));
  if (!results.length || !hasAnyData) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm space-y-1">
        <p className="font-medium text-gray-600">No results to display</p>
        <p className="text-xs">Make sure the selected product has return data imported and the analysis period overlaps with that data.</p>
      </div>
    );
  }

  // Helper to build meta for PDF block downloads
  const buildMeta = (productResult, catResult, pr) => ({
    analysisName: analysis?.name || 'Analysis',
    periodStart: analysis?.period_start,
    periodEnd: analysis?.period_end,
    productName: productResult?.productName,
    firmName: productResult?.firmName,
    returnType: productResult?.returnType,
    benchmarkName: productResult?.benchmarkNames?.filter(Boolean).join(', ') || null,
    category: catResult ? (CATEGORY_LABELS[catResult.category] || catResult.category) : null,
    periodLabel: pr?.window?.label || null,
  });

  // Use smart default based on result type, allow user override
  const getChartType = (key, pr) => chartTypes[key] ?? defaultChartType(pr);
  const toggleChartType = (key, pr) => setChartTypes(prev => {
    const current = prev[key] ?? defaultChartType(pr);
    return { ...prev, [key]: current === "line" ? "bar" : "line" };
  });

  return (
    <div className="space-y-5">
      <div id="analysis-results-content" className="space-y-5 bg-white p-6 rounded-xl border border-gray-200">
      {/* Header */}
      <div className="pdf-block flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-800">Analysis Results</h3>
          {analysis?.period_start && analysis?.period_end && (
            <p className="text-xs text-gray-500 mt-0.5">{analysis.period_start} → {analysis.period_end}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={handleDownload} title="Download PDF or Print"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Download / Print
          </button>
          {(viewMode === "table" || viewMode === "both") && (
            <div className="flex gap-1">
              <button onClick={() => setTableOrientation("vertical")} title="Periods stacked vertically"
                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${tableOrientation === "vertical" ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-500 border-gray-300 hover:border-slate-400"}`}>
                <AlignVerticalJustifyStart className="w-3.5 h-3.5" /> Vertical
              </button>
              <button onClick={() => setTableOrientation("horizontal")} title="Periods as columns"
                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${tableOrientation === "horizontal" ? "bg-slate-700 text-white border-slate-700" : "bg-white text-gray-500 border-gray-300 hover:border-slate-400"}`}>
                <AlignHorizontalJustifyStart className="w-3.5 h-3.5" /> Horizontal
              </button>
            </div>
          )}
          <div className="flex gap-1.5">
            {[
              { key: "table", icon: <LayoutList className="w-3.5 h-3.5" />, label: "Table" },
              { key: "chart", icon: <BarChart2 className="w-3.5 h-3.5" />, label: "Chart" },
              { key: "both", icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Both" },
            ].map(({ key, icon, label }) => (
              <button key={key} onClick={() => setViewMode(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${viewMode === key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Per product */}
      {results.map((productResult, pi) => (
        <div key={pi} className="space-y-4">
          {results.length > 1 && (
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PRODUCT_COLORS[pi % PRODUCT_COLORS.length] }} />
              <span className="text-sm font-bold text-gray-800">{productResult.productName}</span>
              {productResult.firmName && <span className="text-xs text-gray-400">{productResult.firmName}</span>}
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{productResult.returnType}</span>
            </div>
          )}

          {productResult.categories.map((catResult, ci) => (
            <SectionToggle key={ci}
              label={CATEGORY_LABELS[catResult.category] || catResult.category}
              badge={`${catResult.periodResults.length} period${catResult.periodResults.length !== 1 ? "s" : ""}`}>

              {/* Horizontal table mode: one consolidated table, periods as columns */}
              {viewMode !== "chart" && tableOrientation === "horizontal" && (
                <PdfBlock filename={`${analysis?.name || 'Analysis'}-${CATEGORY_LABELS[catResult.category] || catResult.category}-Table.pdf`} meta={buildMeta(productResult, catResult, null)} className="mb-4">
                  <PeriodResultTableHorizontal
                    periodResults={catResult.periodResults}
                    productName={productResult.productName}
                    bmNames={productResult.benchmarkNames}
                    returnType={productResult.returnType}
                    includeCloneProduct={includeCloneProduct}
                  />
                </PdfBlock>
              )}

              {catResult.periodResults.map((pr, pri) => {
                const chartKey = `${pi}-${ci}-${pri}`;

                // Historical
                if (pr.isHistorical) {
                  return (
                    <PdfBlock key={pri} filename={`${analysis?.name || 'Analysis'}-${pr.window.label}-Historical.pdf`} meta={buildMeta(productResult, catResult, pr)} className="mb-4">
                      {(viewMode === "table" || viewMode === "both") && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{pr.window.label} Returns</span>
                          </div>
                          <HistoricalTable periodResult={pr} productName={productResult.productName} bmNames={productResult.benchmarkNames} />
                        </>
                      )}
                      {(viewMode === "chart" || viewMode === "both") && (
                        <div className={viewMode === "both" ? "mt-4" : ""}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{pr.window.label} Returns</span>
                            <button onClick={() => toggleChartType(chartKey, pr)} title={getChartType(chartKey, pr) === "bar" ? "Switch to Line" : "Switch to Bar"}
                              className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-xs">
                              {getChartType(chartKey, pr) === "bar" ? <><TrendingUp className="w-3.5 h-3.5" /> Line</> : <><BarChart2 className="w-3.5 h-3.5" /> Bar</>}
                            </button>
                          </div>
                          <HistoricalChart periodResult={pr} productName={productResult.productName} bmNames={productResult.benchmarkNames} chartType={getChartType(chartKey, pr)} />
                        </div>
                      )}
                    </PdfBlock>
                  );
                }

                // Rolling per attribute — defaults to line (chart-only, no table)
                if (pr.isRolling) {
                  const attrs = catResult.periodResults.find(p => !p.isRolling && !p.isHistorical)
                    ? Object.keys(catResult.periodResults.find(p => !p.isRolling && !p.isHistorical)?.attributeValues || {})
                    : Object.keys(pr.rollingData?.[0]?.values || {});
                  if (viewMode === "table") return null;
                  return (
                    <PdfBlock key={pri} filename={`${analysis?.name || 'Analysis'}-${pr.window.label}-Rolling.pdf`} meta={buildMeta(productResult, catResult, pr)} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{pr.window.label}</span>
                        <button onClick={() => toggleChartType(chartKey, pr)} title={getChartType(chartKey, pr) === "line" ? "Switch to Bar" : "Switch to Line"}
                          className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-xs">
                          {getChartType(chartKey, pr) === "line" ? <><BarChart2 className="w-3.5 h-3.5" /> Bar</> : <><TrendingUp className="w-3.5 h-3.5" /> Line</>}
                        </button>
                      </div>
                      {attrs.slice(0, 4).map(attr => (
                        <div key={attr} className="mb-3">
                          <p className="text-xs text-gray-500 mb-1 font-medium">{attr}</p>
                          <RollingChart periodResult={pr} attribute={attr} productName={productResult.productName} bmNames={productResult.benchmarkNames} chartType={getChartType(chartKey, pr)} />
                        </div>
                      ))}
                      {attrs.length > 4 && <p className="text-xs text-gray-400 mt-1">+{attrs.length - 4} more attributes in table view</p>}
                    </PdfBlock>
                  );
                }

                // Standard period
                const attributes = Object.keys(pr.attributeValues || {});
                const isGrowthOf100 = attributes.includes("Growth of $100") && pr.growthOf100Data;

                // Special rendering for Growth of $100 - show table or chart based on view mode
                if (isGrowthOf100) {
                  return (
                    <PdfBlock key={pri} filename={`${analysis?.name || 'Analysis'}-Growth-of-100.pdf`} meta={buildMeta(productResult, catResult, pr)} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{pr.window.label}</span>
                          <span className="text-[10px] text-gray-400 capitalize">{pr.window.type}</span>
                          {shouldAnnualize(pr.window) && <span className="text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">Ann.</span>}
                        </div>
                      </div>
                      {(viewMode === "table" || viewMode === "both") && (
                        <GrowthOf100Table
                          growthData={pr.growthOf100Data}
                          bmGrowthData={pr.bmGrowthOf100Data}
                          productName={productResult.productName}
                          bmName={productResult.benchmarkNames?.[0]}
                        />
                      )}
                      {(viewMode === "chart" || viewMode === "both") && (
                        <div className={viewMode === "both" ? "mt-4" : ""}>
                          <GrowthOf100Chart
                            growthData={pr.growthOf100Data}
                            bmGrowthData={pr.bmGrowthOf100Data}
                            productName={productResult.productName}
                            bmName={productResult.benchmarkNames?.[0]}
                          />
                        </div>
                      )}
                    </PdfBlock>
                  );
                }

                // In horizontal table mode, skip individual period blocks (consolidated table shown above)
                if (tableOrientation === "horizontal" && viewMode === "table") return null;

                return (
                  <PdfBlock key={pri} filename={`${analysis?.name || 'Analysis'}-${pr.window.label}-${Object.keys(pr.attributeValues || {}).join('-').slice(0, 40)}.pdf`} meta={buildMeta(productResult, catResult, pr)} className="mb-4">
                    {/* Table view */}
                    {(viewMode === "table" || viewMode === "both") && tableOrientation === "vertical" && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{pr.window.label}</span>
                            <span className="text-[10px] text-gray-400 capitalize">{pr.window.type}</span>
                            {shouldAnnualize(pr.window) && <span className="text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">Ann.</span>}
                          </div>
                        </div>
                        <PeriodResultTable
                          periodResult={pr}
                          attributes={attributes}
                          productName={productResult.productName}
                          bmNames={productResult.benchmarkNames}
                          returnType={productResult.returnType}
                          includeCloneProduct={includeCloneProduct}
                        />
                      </>
                    )}
                    {/* Chart view */}
                    {(viewMode === "chart" || viewMode === "both") && attributes.length > 0 && (
                      <div className={viewMode === "both" ? "mt-4" : ""}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{pr.window.label}</span>
                            <span className="text-[10px] text-gray-400 capitalize">{pr.window.type}</span>
                            {shouldAnnualize(pr.window) && <span className="text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">Ann.</span>}
                          </div>
                        </div>
                        {(() => {
                          const chartData = attributes.map(attr => {
                            const productVal = pr.attributeValues?.[attr] ?? null;
                            const benchmarkVal = pr.bmValues?.[attr] ?? null;
                            return {
                              attr,
                              product: productVal,
                              benchmark: benchmarkVal,
                              excess: (productVal != null && benchmarkVal != null) ? productVal - benchmarkVal : null,
                            };
                          });
                          const isGrowthChart = attributes.includes("Growth of $100");
                          return (
                            <ResponsiveContainer width="100%" height={Math.max(180, attributes.length * 28)}>
                              <BarChart data={chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                <XAxis type="number" tickFormatter={v => isRatioMetric(attributes[0]) ? v?.toFixed(1) : `${v?.toFixed(1)}%`} tick={{ fontSize: 9 }} />
                                <YAxis type="category" dataKey="attr" tick={{ fontSize: 9 }} width={130} />
                                <Tooltip formatter={(v, name) => [fmt(v, name === "excess" ? "Excess Return" : "Return"), name]} />
                                <Legend />
                                <ReferenceLine x={0} stroke="#e5e7eb" />
                                {isGrowthChart && <ReferenceLine x={100} stroke="#6B7280" strokeDasharray="4 2" />}
                                <Bar dataKey="product" name={productResult.productName} fill="#4F46E5" />
                                {pr.bmValues && <Bar dataKey="benchmark" name={productResult.benchmarkNames?.[0] || "Benchmark"} fill="#94A3B8" />}
                                {pr.bmValues && <Bar dataKey="excess" name="Excess Return" fill="#F97316" />}
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                    )}
                  </PdfBlock>
                );
              })}

              {/* Cross-period attribute comparison charts (chart/both mode, non-rolling) */}
              {viewMode !== "table" && catResult.periodResults.filter(pr => !pr.isRolling && !pr.isHistorical).length > 1 && (
                <PdfBlock filename={`${analysis?.name || 'Analysis'}-Cross-Period-Comparison.pdf`} meta={buildMeta(productResult, catResult, { window: { label: 'Cross-Period Comparison' } })} className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cross-Period Comparison</p>
                  {Object.keys(catResult.periodResults.find(pr => !pr.isRolling && !pr.isHistorical)?.attributeValues || {}).slice(0, 3).map(attr => (
                    <div key={attr} className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-600">{attr}</p>
                      </div>
                      <AttributeBarChart
                        periodResults={catResult.periodResults}
                        attribute={attr}
                        productNames={[productResult.productName]}
                        bmNames={productResult.benchmarkNames}
                      />
                    </div>
                  ))}
                </PdfBlock>
              )}
            </SectionToggle>
          ))}
        </div>
      ))}
      </div>
    </div>
  );
}