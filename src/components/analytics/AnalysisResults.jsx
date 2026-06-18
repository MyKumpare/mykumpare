import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, TrendingUp, LayoutList, ChevronDown, ChevronUp, Download, AlignVerticalJustifyStart, AlignHorizontalJustifyStart } from "lucide-react";
import { runAnalysis, isRatioMetric } from "./analyticsCalculations";

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

function PeriodResultTable({ periodResult, attributes, productName, bmNames }) {
  const { attributeValues, bmValues, observations } = periodResult;
  const hasBm = !!bmValues;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 w-40">Attribute</th>
            <th className="text-right px-3 py-2 font-semibold text-indigo-700">{productName}</th>
            {hasBm && <th className="text-right px-3 py-2 font-semibold text-gray-500">{bmNames?.[0] || "Benchmark"}</th>}
            {hasBm && <th className="text-right px-3 py-2 font-semibold text-orange-600">Excess</th>}
          </tr>
        </thead>
        <tbody>
          {attributes.map((attr, i) => {
            const pVal = attributeValues?.[attr];
            const bVal = bmValues?.[attr];
            const excess = (pVal !== null && pVal !== undefined && bVal !== null && bVal !== undefined) ? pVal - bVal : null;
            return (
              <tr key={attr} className={`border-b border-gray-100 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                <td className="px-3 py-2 text-gray-600 font-medium">{attr}</td>
                <td className={`px-3 py-2 text-right font-semibold ${colorClass(pVal, attr)}`}>{fmt(pVal, attr)}</td>
                {hasBm && <td className={`px-3 py-2 text-right font-medium ${colorClass(bVal, attr)}`}>{fmt(bVal, attr)}</td>}
                {hasBm && <td className={`px-3 py-2 text-right font-semibold ${colorClass(excess, attr)}`}>{fmt(excess, attr)}</td>}
              </tr>
            );
          })}
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
        <Tooltip formatter={(v, name) => [fmt(v, attribute), name]} />
        <Legend />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Bar dataKey="product" name={productNames[0]} fill={PRODUCT_COLORS[0]}>
          {data.map((d, i) => <Cell key={i} fill={(d.product ?? 0) >= 0 ? PRODUCT_COLORS[0] : "#EF4444"} />)}
        </Bar>
        {hasBm && <Bar dataKey="benchmark" name={bmNames?.[0] || "Benchmark"} fill={BM_COLOR} />}
        {hasBm && <Bar dataKey="excess" name="Excess Return" fill="#F97316">
          {data.map((d, i) => <Cell key={i} fill={(d.excess ?? 0) >= 0 ? "#F97316" : "#EF4444"} />)}
        </Bar>}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Horizontal table: attributes as rows, periods as columns
function PeriodResultTableHorizontal({ periodResults, productName, bmNames }) {
  const standardPeriods = periodResults.filter(pr => !pr.isRolling && !pr.isHistorical);
  if (standardPeriods.length === 0) return null;
  const attributes = Object.keys(standardPeriods[0]?.attributeValues || {});
  const hasBm = standardPeriods.some(pr => !!pr.bmValues);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 sticky left-0 bg-gray-50 min-w-[140px]">Attribute</th>
            {standardPeriods.map((pr, i) => (
              <th key={i} className="px-3 py-2 font-semibold text-center min-w-[90px]">
                <span className="text-indigo-700 block">{pr.window.label}</span>
                {hasBm && <span className="text-gray-400 font-normal text-[10px] block">{productName} / {bmNames?.[0] || "BM"} / Excess</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map((attr, ai) => (
            <tr key={attr} className={`border-b border-gray-100 ${ai % 2 === 0 ? "" : "bg-gray-50/50"}`}>
              <td className="px-3 py-2 text-gray-600 font-medium sticky left-0 bg-inherit">{attr}</td>
              {standardPeriods.map((pr, pi) => {
                const pVal = pr.attributeValues?.[attr];
                const bVal = pr.bmValues?.[attr];
                const excess = (pVal != null && bVal != null) ? pVal - bVal : null;
                return (
                  <td key={pi} className="px-3 py-2 text-center">
                    <span className={`font-semibold block ${colorClass(pVal, attr)}`}>{fmt(pVal, attr)}</span>
                    {hasBm && (
                      <>
                        <span className={`block ${colorClass(bVal, attr)}`}>{fmt(bVal, attr)}</span>
                        <span className={`block font-semibold ${colorClass(excess, attr)}`}>{fmt(excess, attr)}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
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

export default function AnalysisResults({ analysis, products, benchmarks, returnSeries }) {
  const [viewMode, setViewMode] = useState("table");
  const [chartTypes, setChartTypes] = useState({});
  const [tableOrientation, setTableOrientation] = useState("vertical"); // "vertical" | "horizontal"

  const results = useMemo(() => {
    if (!analysis || !returnSeries || !benchmarks) return [];
    return runAnalysis({ analysis, allSeries: returnSeries, allBenchmarks: benchmarks });
  }, [analysis, returnSeries, benchmarks]);

  const hasAnyData = results.some(r => r.categories?.some(c => c.periodResults?.length > 0));
  if (!results.length || !hasAnyData) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm space-y-1">
        <p className="font-medium text-gray-600">No results to display</p>
        <p className="text-xs">Make sure the selected product has return data imported and the analysis period overlaps with that data.</p>
      </div>
    );
  }

  // Use smart default based on result type, allow user override
  const getChartType = (key, pr) => chartTypes[key] ?? defaultChartType(pr);
  const toggleChartType = (key, pr) => setChartTypes(prev => {
    const current = prev[key] ?? defaultChartType(pr);
    return { ...prev, [key]: current === "line" ? "bar" : "line" };
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-800">Analysis Results</h3>
          {analysis?.period_start && analysis?.period_end && (
            <p className="text-xs text-gray-500 mt-0.5">{analysis.period_start} → {analysis.period_end}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
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
                <div className="mb-4">
                  <PeriodResultTableHorizontal
                    periodResults={catResult.periodResults}
                    productName={productResult.productName}
                    bmNames={productResult.benchmarkNames}
                  />
                </div>
              )}

              {catResult.periodResults.map((pr, pri) => {
                const chartKey = `${pi}-${ci}-${pri}`;

                // Historical
                if (pr.isHistorical) {
                  return (
                    <div key={pri} className="mb-4">
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
                    </div>
                  );
                }

                // Rolling per attribute — defaults to line (chart-only, no table)
                if (pr.isRolling) {
                  const attrs = catResult.periodResults.find(p => !p.isRolling && !p.isHistorical)
                    ? Object.keys(catResult.periodResults.find(p => !p.isRolling && !p.isHistorical)?.attributeValues || {})
                    : Object.keys(pr.rollingData?.[0]?.values || {});
                  if (viewMode === "table") return null;
                  return (
                    <div key={pri} className="mb-4">
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
                    </div>
                  );
                }

                // Standard period
                const attributes = Object.keys(pr.attributeValues || {});

                // In horizontal table mode, skip individual period blocks (consolidated table shown above)
                if (tableOrientation === "horizontal" && viewMode === "table") return null;

                return (
                  <div key={pri} className="mb-4">
                    {/* Table view */}
                    {(viewMode === "table" || viewMode === "both") && tableOrientation === "vertical" && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{pr.window.label}</span>
                            <span className="text-[10px] text-gray-400 capitalize">{pr.window.type}</span>
                          </div>
                        </div>
                        <PeriodResultTable
                          periodResult={pr}
                          attributes={attributes}
                          productName={productResult.productName}
                          bmNames={productResult.benchmarkNames}
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
                          </div>
                          <button onClick={() => toggleChartType(chartKey, pr)} title={getChartType(chartKey, pr) === "bar" ? "Switch to Line" : "Switch to Bar"}
                            className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-xs">
                            {getChartType(chartKey, pr) === "bar" ? <><TrendingUp className="w-3.5 h-3.5" /> Line</> : <><BarChart2 className="w-3.5 h-3.5" /> Bar</>}
                          </button>
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
                          return (
                            <ResponsiveContainer width="100%" height={Math.max(180, attributes.length * 28)}>
                              <BarChart data={chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                <XAxis type="number" tickFormatter={v => isRatioMetric(attributes[0]) ? v?.toFixed(1) : `${v?.toFixed(1)}%`} tick={{ fontSize: 9 }} />
                                <YAxis type="category" dataKey="attr" tick={{ fontSize: 9 }} width={130} />
                                <Tooltip formatter={(v, name) => [fmt(v, name === "excess" ? "Excess Return" : "Return"), name]} />
                                <Legend />
                                <ReferenceLine x={0} stroke="#e5e7eb" />
                                <Bar dataKey="product" name={productResult.productName} fill={PRODUCT_COLORS[pi % PRODUCT_COLORS.length]}>
                                  {chartData.map((d, i) => <Cell key={i} fill={PRODUCT_COLORS[pi % PRODUCT_COLORS.length]} />)}
                                </Bar>
                                {pr.bmValues && <Bar dataKey="benchmark" name={productResult.benchmarkNames?.[0] || "Benchmark"} fill={BM_COLOR} />}
                                {pr.bmValues && <Bar dataKey="excess" name="Excess Return" fill="#F97316">
                                  {chartData.map((d, i) => <Cell key={i} fill={(d.product ?? 0) > (d.benchmark ?? 0) ? "#10B981" : "#EF4444"} />)}
                                </Bar>}
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Cross-period attribute comparison charts (chart/both mode, non-rolling) */}
              {viewMode !== "table" && catResult.periodResults.filter(pr => !pr.isRolling && !pr.isHistorical).length > 1 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
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
                </div>
              )}
            </SectionToggle>
          ))}
        </div>
      ))}
    </div>
  );
}