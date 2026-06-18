import React, { useRef, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { isRatioMetric, shouldAnnualize } from "./analyticsCalculations";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const PRODUCT_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16"];
export const BM_COLOR = "#94A3B8";

export const CATEGORY_LABELS = {
  performance: "Performance",
  risk: "Risk and Regression",
  efficiency: "Efficiency",
  valueAtRisk: "Value at Risk",
  population: "Population Calculations",
};

export function fmt(val, attribute) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  if (attribute === "Number of Observations") return Math.round(val).toString();
  if (attribute === "Growth of $100") return `$${val.toFixed(2)}`;
  if (attribute === "R-Squared") return `${val.toFixed(2)}%`;
  if (isRatioMetric(attribute)) return val.toFixed(3);
  return `${val.toFixed(2)}%`;
}

export function colorClass(val, attribute) {
  if (val === null || val === undefined || isNaN(val)) return "text-gray-400";
  if (attribute === "Number of Observations" || attribute === "Growth of $100") return "text-gray-800";
  return val >= 0 ? "text-green-700" : "text-red-600";
}

export function SectionToggle({ label, badge, children }) {
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

async function downloadBlock(el, filename, meta = {}) {
  if (!el) return;
  const origCursor = document.body.style.cursor;
  document.body.style.cursor = 'wait';
  const safe = (v) => v ? String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
  const renderW = 900;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;top:-99999px;left:-99999px;width:${renderW}px;overflow:visible;background:#fff;font-family:sans-serif;`;
  const header = document.createElement('div');
  header.style.cssText = `padding:16px 20px 12px;border-bottom:2px solid #e5e7eb;width:${renderW}px;box-sizing:border-box;`;
  header.innerHTML = `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;"><div><div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">${safe(meta.analysisName) || 'Analysis'}</div>${meta.periodLabel ? `<div style="font-size:11px;color:#6366f1;font-weight:600;margin-bottom:2px;">${safe(meta.periodLabel)}</div>` : ''}${meta.category ? `<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${safe(meta.category)}</div>` : ''}</div><div style="text-align:right;flex-shrink:0;">${meta.periodStart && meta.periodEnd ? `<div style="font-size:10px;color:#64748b;margin-bottom:3px;"><b>Period:</b> ${safe(meta.periodStart)} &rarr; ${safe(meta.periodEnd)}</div>` : ''}${meta.productName ? `<div style="font-size:10px;color:#64748b;margin-bottom:3px;"><b>Product:</b> ${safe(meta.productName)}</div>` : ''}${meta.benchmarkName ? `<div style="font-size:10px;color:#64748b;"><b>Benchmark:</b> ${safe(meta.benchmarkName)}</div>` : ''}</div></div>`;
  const clone = el.cloneNode(true);
  clone.style.cssText = `width:${renderW}px;overflow:visible;`;
  clone.querySelectorAll('*').forEach(d => { d.style.overflow = 'visible'; d.style.overflowX = 'visible'; d.style.overflowY = 'visible'; d.style.maxHeight = 'none'; });
  clone.querySelectorAll('button').forEach(b => { if (b.title === 'Download as PDF') b.style.display = 'none'; });
  wrapper.appendChild(header);
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  try {
    clone.querySelectorAll('.recharts-responsive-container').forEach(svg => { svg.style.width = `${renderW}px`; svg.style.minWidth = `${renderW}px`; });
    await new Promise(r => setTimeout(r, 250));
    const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: renderW, windowWidth: renderW, logging: false });
    document.body.removeChild(wrapper);
    const naturalH = canvas.height / 2, naturalW = canvas.width / 2;
    const orientation = naturalH > naturalW ? 'portrait' : 'landscape';
    const pdf = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
    const pgW = pdf.internal.pageSize.getWidth(), pgH = pdf.internal.pageSize.getHeight(), margin = 28;
    const fitScale = Math.min((pgW - margin * 2) / canvas.width, (pgH - margin * 2) / canvas.height);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pgW - canvas.width * fitScale) / 2, margin, canvas.width * fitScale, canvas.height * fitScale);
    pdf.save(filename);
  } catch (e) { console.error(e); }
  finally { if (document.body.contains(wrapper)) document.body.removeChild(wrapper); document.body.style.cursor = origCursor; }
}

export function PdfBlock({ filename, meta = {}, className = "", children }) {
  const ref = useRef(null);
  return (
    <div ref={ref} className={`pdf-block relative group ${className}`} data-pdf-meta={JSON.stringify(meta)}>
      <button onClick={() => downloadBlock(ref.current, filename, meta)} title="Download as PDF"
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 bg-white text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-all text-xs shadow-sm">
        <Download className="w-3 h-3" /> PDF
      </button>
      {children}
    </div>
  );
}

export function PeriodResultTable({ periodResult, attributes, productName, bmNames, returnType, includeCloneProduct }) {
  const { attributeValues, bmValues, observations } = periodResult;
  const hasBm = !!bmValues;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 w-40">Attribute</th>
            {attributes.map(attr => <th key={attr} className="text-right px-3 py-2 font-semibold text-indigo-700 min-w-[90px]">{attr}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="px-3 py-2 text-gray-600 font-medium">
              {productName}
              {returnType && <span className="text-gray-400 font-normal"> — {returnType.charAt(0).toUpperCase() + returnType.slice(1)} Return</span>}
              {includeCloneProduct && <span className="text-gray-400 font-normal"> (Clone)</span>}
            </td>
            {attributes.map(attr => <td key={attr} className={`px-3 py-2 text-right font-semibold ${colorClass(attributeValues?.[attr], attr)}`}>{fmt(attributeValues?.[attr], attr)}</td>)}
          </tr>
          {hasBm && (
            <tr className="border-b border-gray-100">
              <td className="px-3 py-2 text-gray-600 font-medium">{bmNames?.[0] || "Benchmark"}</td>
              {attributes.map(attr => <td key={attr} className={`px-3 py-2 text-right font-medium ${colorClass(bmValues?.[attr], attr)}`}>{fmt(bmValues?.[attr], attr)}</td>)}
            </tr>
          )}
          {hasBm && (
            <tr className="border-t-2 border-gray-200">
              <td className="px-3 py-2 text-gray-600 font-semibold text-orange-600">Excess Return</td>
              {attributes.map(attr => {
                const excess = (attributeValues?.[attr] != null && bmValues?.[attr] != null) ? attributeValues[attr] - bmValues[attr] : null;
                return <td key={attr} className={`px-3 py-2 text-right font-semibold ${colorClass(excess, attr)}`}>{fmt(excess, attr)}</td>;
              })}
            </tr>
          )}
        </tbody>
      </table>
      {observations > 0 && <p className="text-[10px] text-gray-400 px-3 pt-1">n = {observations} monthly observations</p>}
    </div>
  );
}

export function PeriodResultTableHorizontal({ periodResults, productName, bmNames, returnType, includeCloneProduct }) {
  const standardPeriods = periodResults.filter(pr => !pr.isRolling && !pr.isHistorical);
  if (!standardPeriods.length) return null;
  const allAttrs = [...new Set(standardPeriods.flatMap(pr => Object.keys(pr.attributeValues || {})))];
  const hasBm = standardPeriods.some(pr => !!pr.bmValues);
  return (
    <div className="w-full overflow-x-auto">
      <table className="text-xs" style={{ width: "100%", tableLayout: "auto", borderCollapse: "collapse" }}>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 whitespace-nowrap" style={{ width: "1%" }}></th>
            {standardPeriods.map((pr, i) => <th key={i} className="px-3 py-2 font-semibold text-indigo-700 text-center whitespace-nowrap">{pr.window.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {allAttrs.map((attr, attrIdx) => (
            <React.Fragment key={attr}>
              {allAttrs.length > 1 && (
                <tr className="bg-gray-50/70">
                  <td colSpan={standardPeriods.length + 1} className="px-3 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{attr}</td>
                </tr>
              )}
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-600 font-medium whitespace-nowrap">
                  {productName}
                  {returnType && <span className="text-gray-400 font-normal"> — {returnType.charAt(0).toUpperCase() + returnType.slice(1)}</span>}
                  {includeCloneProduct && <span className="text-gray-400 font-normal"> (Clone)</span>}
                </td>
                {standardPeriods.map((pr, pi) => <td key={pi} className={`px-3 py-2 text-center font-semibold whitespace-nowrap ${colorClass(pr.attributeValues?.[attr], attr)}`}>{fmt(pr.attributeValues?.[attr], attr)}</td>)}
              </tr>
              {hasBm && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-600 font-medium whitespace-nowrap">{bmNames?.[0] || "Benchmark"}</td>
                  {standardPeriods.map((pr, pi) => <td key={pi} className={`px-3 py-2 text-center whitespace-nowrap ${colorClass(pr.bmValues?.[attr], attr)}`}>{fmt(pr.bmValues?.[attr], attr)}</td>)}
                </tr>
              )}
              {hasBm && (
                <tr className={`border-t-2 border-gray-200 ${attrIdx < allAttrs.length - 1 ? "border-b-4 border-b-gray-100" : ""}`}>
                  <td className="px-3 py-2 text-orange-600 font-semibold whitespace-nowrap">Excess Return</td>
                  {standardPeriods.map((pr, pi) => {
                    const excess = (pr.attributeValues?.[attr] != null && pr.bmValues?.[attr] != null) ? pr.attributeValues[attr] - pr.bmValues[attr] : null;
                    return <td key={pi} className={`px-3 py-2 text-center font-semibold whitespace-nowrap ${colorClass(excess, attr)}`}>{fmt(excess, attr)}</td>;
                  })}
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoricalTable({ periodResult, productName, bmNames }) {
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

export function HistoricalChart({ periodResult, productName, bmNames, chartType }) {
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

export function RollingChart({ periodResult, attribute, productName, chartType }) {
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

export function GrowthOf100Table({ growthData, bmGrowthData, productName, bmName }) {
  const hasBm = bmGrowthData?.length > 0;
  const formatDate = (ymStr) => {
    if (!ymStr) return "";
    const [year, month] = ymStr.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
  };
  const data = [{ date: "Start", product: 100, benchmark: hasBm ? 100 : null, isStartRow: true }, ...growthData.map((row, i) => ({ date: formatDate(row.date), product: row.value, benchmark: bmGrowthData?.[i]?.value ?? null }))];
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
            const excess = row.benchmark != null ? row.product - row.benchmark : null;
            if (row.isStartRow) return (
              <tr key="start" className="border-b border-gray-200 bg-indigo-50/50 font-semibold">
                <td className="px-3 py-2 text-gray-700">Start</td>
                <td className="px-3 py-2 text-right text-indigo-700">$100.00</td>
                {hasBm && <><td className="px-3 py-2 text-right text-gray-600">$100.00</td><td className="px-3 py-2 text-right text-gray-400">$0.00</td></>}
              </tr>
            );
            return (
              <tr key={i} className={`border-b border-gray-100 ${(i - 1) % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                <td className="px-3 py-2 text-gray-600 font-medium">{row.date}</td>
                <td className={`px-3 py-2 text-right font-semibold ${row.product >= 100 ? "text-green-700" : "text-red-600"}`}>${row.product?.toFixed(2)}</td>
                {hasBm && <><td className={`px-3 py-2 text-right ${row.benchmark >= 100 ? "text-green-700" : "text-red-600"}`}>${row.benchmark?.toFixed(2)}</td><td className={`px-3 py-2 text-right font-semibold ${excess >= 0 ? "text-green-700" : "text-red-600"}`}>${excess?.toFixed(2)}</td></>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GrowthOf100Chart({ growthData, bmGrowthData, productName, bmName }) {
  const hasBm = bmGrowthData?.length > 0;
  const formatDate = (ymStr) => { if (!ymStr) return ""; const [year, month] = ymStr.split("-").map(Number); const lastDay = new Date(year, month, 0).getDate(); return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`; };
  const firstDate = growthData?.[0]?.date || "";
  const data = [{ date: formatDate(firstDate), product: 100, benchmark: hasBm ? 100 : null }, ...growthData.map((row, i) => ({ date: formatDate(row.date), product: row.value, benchmark: bmGrowthData?.[i]?.value ?? null }))];
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

export function AttributeBarChart({ periodResults, attribute, productNames, bmNames }) {
  const comparablePeriods = periodResults.filter(pr => !pr.isRolling && !pr.isHistorical);
  if (!comparablePeriods.length) return null;
  const data = comparablePeriods.map(pr => {
    const entry = { period: pr.window.label, product: pr.attributeValues?.[attribute] ?? null };
    if (pr.bmValues) { entry.benchmark = pr.bmValues?.[attribute] ?? null; entry.excess = (entry.product != null && entry.benchmark != null) ? entry.product - entry.benchmark : null; }
    return entry;
  });
  const hasBm = data.some(d => d.benchmark !== undefined);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={v => isRatioMetric(attribute) ? v?.toFixed(2) : `${v?.toFixed(1)}%`} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v, name) => { const val = fmt(v, attribute); return [<span style={{ color: name === "excess" && v != null ? (v > 0 ? "#10B981" : "#EF4444") : "inherit" }}>{val}</span>, name]; }} />
        <Legend />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Bar dataKey="product" name={productNames[0]} fill="#4F46E5" />
        {hasBm && <Bar dataKey="benchmark" name={bmNames?.[0] || "Benchmark"} fill="#94A3B8" />}
        {hasBm && <Bar dataKey="excess" name="Excess Return" fill="#F97316" />}
      </BarChart>
    </ResponsiveContainer>
  );
}