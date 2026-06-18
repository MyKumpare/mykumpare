import React from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { BarChart2, TrendingUp } from "lucide-react";
import { isRatioMetric, shouldAnnualize } from "./analyticsCalculations";
import { fmt, colorClass, PRODUCT_COLORS, BM_COLOR, CATEGORY_LABELS, SectionToggle, PdfBlock, PeriodResultTable, PeriodResultTableHorizontal, HistoricalTable, HistoricalChart, RollingChart, GrowthOf100Table, GrowthOf100Chart, AttributeBarChart } from "./AnalysisResultsShared";

// Multi-product side-by-side table: all products as rows per period
export function MultiProductPeriodTable({ periodResults, attributes, productNames, bmNamesList, returnTypes }) {
  const firstPr = periodResults[0];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ tableLayout: "auto", borderCollapse: "collapse" }}>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">Product / Benchmark</th>
            {attributes.map(attr => (
              <th key={attr} className="text-right px-3 py-2 font-semibold text-indigo-700 whitespace-nowrap min-w-[90px]">{attr}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periodResults.map((pr, pi) => {
            if (!pr) return null;
            const color = PRODUCT_COLORS[pi % PRODUCT_COLORS.length];
            const bmName = bmNamesList?.[pi]?.[0];
            const hasBmForProduct = !!pr.bmValues;
            return (
              <React.Fragment key={pi}>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color }}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 mb-0.5" style={{ background: color }} />
                    {productNames[pi]}
                    {returnTypes?.[pi] && <span className="text-gray-400 font-normal text-[10px] ml-1">({returnTypes[pi].charAt(0).toUpperCase() + returnTypes[pi].slice(1)})</span>}
                  </td>
                  {attributes.map(attr => {
                    const val = pr.attributeValues?.[attr];
                    return <td key={attr} className={`px-3 py-2 text-right font-semibold ${colorClass(val, attr)}`}>{fmt(val, attr)}</td>;
                  })}
                </tr>
                {hasBmForProduct && bmName && (
                  <tr className="border-b border-gray-100 bg-gray-50/30">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap pl-6">{bmName}</td>
                    {attributes.map(attr => {
                      const val = pr.bmValues?.[attr];
                      return <td key={attr} className={`px-3 py-2 text-right ${colorClass(val, attr)}`}>{fmt(val, attr)}</td>;
                    })}
                  </tr>
                )}
                {hasBmForProduct && bmName && (
                  <tr className={`border-b-2 border-gray-200 ${pi < periodResults.length - 1 ? "border-b-4 border-b-gray-100" : ""}`}>
                    <td className="px-3 py-2 text-orange-600 font-semibold whitespace-nowrap pl-6">Excess</td>
                    {attributes.map(attr => {
                      const pVal = pr.attributeValues?.[attr];
                      const bVal = pr.bmValues?.[attr];
                      const excess = (pVal != null && bVal != null) ? pVal - bVal : null;
                      return <td key={attr} className={`px-3 py-2 text-right font-semibold ${colorClass(excess, attr)}`}>{fmt(excess, attr)}</td>;
                    })}
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {firstPr?.observations > 0 && <p className="text-[10px] text-gray-400 px-3 pt-1">n = {firstPr.observations} monthly observations</p>}
    </div>
  );
}

// Multi-product attribute comparison chart
function MultiProductAttributeChart({ periodResults, attributes, productNames, bmNamesList }) {
  const chartData = attributes.map(attr => {
    const entry = { attr };
    periodResults.forEach((pr, pi) => { entry[`p${pi}`] = pr?.attributeValues?.[attr] ?? null; });
    const firstBmPr = periodResults.find(pr => !!pr?.bmValues);
    if (firstBmPr) entry.benchmark = firstBmPr.bmValues?.[attr] ?? null;
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, attributes.length * 32)}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tickFormatter={v => isRatioMetric(attributes[0]) ? v?.toFixed(1) : `${v?.toFixed(1)}%`} tick={{ fontSize: 9 }} />
        <YAxis type="category" dataKey="attr" tick={{ fontSize: 9 }} width={130} />
        <Tooltip formatter={(v, name) => [fmt(v, name), name]} />
        <Legend />
        <ReferenceLine x={0} stroke="#e5e7eb" />
        {periodResults.map((_, pi) => (
          <Bar key={pi} dataKey={`p${pi}`} name={productNames[pi]} fill={PRODUCT_COLORS[pi % PRODUCT_COLORS.length]} />
        ))}
        {chartData.some(d => d.benchmark != null) && (
          <Bar dataKey="benchmark" name={bmNamesList?.[0]?.[0] || "Benchmark"} fill={BM_COLOR} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MultiProductResults({ results, analysis, viewMode, tableOrientation, getChartType, toggleChartType, buildMeta }) {
  if (!results.length) return null;
  const categoryCount = results[0]?.categories?.length ?? 0;

  return (
    <div className="space-y-4">
      {Array.from({ length: categoryCount }).map((_, ci) => {
        const catResult = results[0].categories[ci];
        if (!catResult) return null;
        const periodCount = catResult.periodResults.length;
        const productNames = results.map(r => r.productName);
        const bmNamesList = results.map(r => r.benchmarkNames);
        const returnTypes = results.map(r => r.returnType);

        return (
          <SectionToggle key={ci}
            label={CATEGORY_LABELS[catResult.category] || catResult.category}
            badge={`${results.length} products · ${periodCount} period${periodCount !== 1 ? "s" : ""}`}>

            {/* Horizontal consolidated table */}
            {viewMode !== "chart" && tableOrientation === "horizontal" && (() => {
              const standardPeriods = catResult.periodResults.filter(pr => !pr.isRolling && !pr.isHistorical);
              if (!standardPeriods.length) return null;
              const allAttrs = [...new Set(standardPeriods.flatMap(pr => Object.keys(pr.attributeValues || {})))];
              return (
                <div className="overflow-x-auto mb-4">
                  <table className="text-xs w-full" style={{ tableLayout: "auto", borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-3 py-2 font-semibold text-gray-500 whitespace-nowrap"></th>
                        {standardPeriods.map((pr, pIdx) => (
                          <th key={pIdx} className="px-3 py-2 font-semibold text-indigo-700 text-center whitespace-nowrap">{pr.window.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allAttrs.map(attr => (
                        <React.Fragment key={attr}>
                          <tr className="bg-gray-50/70">
                            <td colSpan={standardPeriods.length + 1} className="px-3 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{attr}</td>
                          </tr>
                          {results.map((productResult, pi) => {
                            const color = PRODUCT_COLORS[pi % PRODUCT_COLORS.length];
                            const productStdPeriods = productResult.categories[ci]?.periodResults?.filter(pr => !pr.isRolling && !pr.isHistorical) ?? [];
                            return (
                              <tr key={pi} className="border-b border-gray-100">
                                <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color }}>
                                  <span className="inline-block w-2 h-2 rounded-full mr-1.5 mb-0.5" style={{ background: color }} />
                                  {productResult.productName}
                                  {productResult.returnType && <span className="text-gray-400 font-normal text-[10px] ml-1">({productResult.returnType.charAt(0).toUpperCase() + productResult.returnType.slice(1)})</span>}
                                </td>
                                {standardPeriods.map((_, pIdx) => {
                                  const pr = productStdPeriods[pIdx];
                                  const val = pr?.attributeValues?.[attr];
                                  return <td key={pIdx} className={`px-3 py-2 text-center font-semibold whitespace-nowrap ${colorClass(val, attr)}`}>{fmt(val, attr)}</td>;
                                })}
                              </tr>
                            );
                          })}
                          {/* Benchmark row */}
                          {(() => {
                            const firstProdWithBm = results.find(r => r.categories[ci]?.periodResults?.find(pr => !pr.isRolling && !pr.isHistorical)?.bmValues);
                            if (!firstProdWithBm) return null;
                            const bmStdPeriods = firstProdWithBm.categories[ci]?.periodResults?.filter(pr => !pr.isRolling && !pr.isHistorical) ?? [];
                            const bmName = firstProdWithBm.benchmarkNames?.[0];
                            return (
                              <tr key="bm" className="border-b border-gray-100 bg-gray-50/50">
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{bmName || "Benchmark"}</td>
                                {standardPeriods.map((_, pIdx) => {
                                  const pr = bmStdPeriods[pIdx];
                                  const val = pr?.bmValues?.[attr];
                                  return <td key={pIdx} className={`px-3 py-2 text-center whitespace-nowrap ${colorClass(val, attr)}`}>{fmt(val, attr)}</td>;
                                })}
                              </tr>
                            );
                          })()}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Per-period blocks */}
            {catResult.periodResults.map((pr, pri) => {
              const chartKey = `multi-${ci}-${pri}`;
              const allProductPeriodResults = results.map(r => r.categories[ci]?.periodResults?.[pri] ?? null);
              const attributes = Object.keys(pr.attributeValues || {});

              if (pr.isHistorical) {
                if (viewMode === "table" || viewMode === "both") {
                  return (
                    <div key={pri} className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{pr.window.label} Returns</span>
                      </div>
                      {results.map((productResult, pi) => {
                        const productPr = productResult.categories[ci]?.periodResults?.[pri];
                        if (!productPr) return null;
                        return (
                          <div key={pi} className="mb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-block w-2 h-2 rounded-full" style={{ background: PRODUCT_COLORS[pi % PRODUCT_COLORS.length] }} />
                              <span className="text-xs font-semibold" style={{ color: PRODUCT_COLORS[pi % PRODUCT_COLORS.length] }}>{productResult.productName}</span>
                            </div>
                            <HistoricalTable periodResult={productPr} productName={productResult.productName} bmNames={productResult.benchmarkNames} />
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }

              if (pr.isRolling) {
                if (viewMode === "table") return null;
                const attrs = Object.keys(pr.rollingData?.[0]?.values || {});
                return (
                  <div key={pri} className="mb-4">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{pr.window.label}</span>
                    {attrs.slice(0, 4).map(attr => (
                      <div key={attr} className="mb-3 mt-2">
                        <p className="text-xs text-gray-500 mb-1 font-medium">{attr}</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={v => isRatioMetric(attr) ? v?.toFixed(2) : `${v?.toFixed(1)}%`} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v) => [fmt(v, attr), attr]} />
                            <Legend />
                            <ReferenceLine y={0} stroke="#e5e7eb" />
                            {results.map((productResult, pi) => {
                              const productPr = productResult.categories[ci]?.periodResults?.[pri];
                              const data = (productPr?.rollingData ?? []).map(r => ({ date: r.date?.slice(0, 7), value: r.values?.[attr] ?? null }));
                              return <Line key={pi} data={data} type="monotone" dataKey="value" name={productResult.productName} stroke={PRODUCT_COLORS[pi % PRODUCT_COLORS.length]} strokeWidth={1.5} dot={false} />;
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                );
              }

              if (tableOrientation === "horizontal" && viewMode === "table") return null;

              return (
                <PdfBlock key={pri}
                  filename={`${analysis?.name || 'Analysis'}-${pr.window.label}-MultiProduct.pdf`}
                  meta={{ ...buildMeta(results[0], catResult, pr), productName: productNames.join(' vs ') }}
                  className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{pr.window.label}</span>
                      <span className="text-[10px] text-gray-400 capitalize">{pr.window.type}</span>
                      {shouldAnnualize(pr.window) && <span className="text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">Ann.</span>}
                    </div>
                    {viewMode !== "table" && (
                      <button onClick={() => toggleChartType(chartKey, pr)} className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-xs">
                        {getChartType(chartKey, pr) === "bar" ? <><TrendingUp className="w-3.5 h-3.5" /> Line</> : <><BarChart2 className="w-3.5 h-3.5" /> Bar</>}
                      </button>
                    )}
                  </div>
                  {(viewMode === "table" || viewMode === "both") && tableOrientation === "vertical" && (
                    <MultiProductPeriodTable
                      periodResults={allProductPeriodResults}
                      attributes={attributes}
                      productNames={productNames}
                      bmNamesList={bmNamesList}
                      returnTypes={returnTypes}
                    />
                  )}
                  {(viewMode === "chart" || viewMode === "both") && attributes.length > 0 && (
                    <div className={viewMode === "both" ? "mt-4" : ""}>
                      <MultiProductAttributeChart
                        periodResults={allProductPeriodResults}
                        attributes={attributes}
                        productNames={productNames}
                        bmNamesList={bmNamesList}
                      />
                    </div>
                  )}
                </PdfBlock>
              );
            })}
          </SectionToggle>
        );
      })}
    </div>
  );
}

export function SingleProductResult({ productResult, pi, analysis, viewMode, tableOrientation, getChartType, toggleChartType, buildMeta, includeCloneProduct, showProductHeader }) {
  return (
    <div className="space-y-4">
      {showProductHeader && (
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
                        <button onClick={() => toggleChartType(chartKey, pr)} className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-xs">
                          {getChartType(chartKey, pr) === "bar" ? <><TrendingUp className="w-3.5 h-3.5" /> Line</> : <><BarChart2 className="w-3.5 h-3.5" /> Bar</>}
                        </button>
                      </div>
                      <HistoricalChart periodResult={pr} productName={productResult.productName} bmNames={productResult.benchmarkNames} chartType={getChartType(chartKey, pr)} />
                    </div>
                  )}
                </PdfBlock>
              );
            }

            if (pr.isRolling) {
              const attrs = catResult.periodResults.find(p => !p.isRolling && !p.isHistorical)
                ? Object.keys(catResult.periodResults.find(p => !p.isRolling && !p.isHistorical)?.attributeValues || {})
                : Object.keys(pr.rollingData?.[0]?.values || {});
              if (viewMode === "table") return null;
              return (
                <PdfBlock key={pri} filename={`${analysis?.name || 'Analysis'}-${pr.window.label}-Rolling.pdf`} meta={buildMeta(productResult, catResult, pr)} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{pr.window.label}</span>
                    <button onClick={() => toggleChartType(chartKey, pr)} className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-xs">
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

            const attributes = Object.keys(pr.attributeValues || {});
            const isGrowthOf100 = attributes.includes("Growth of $100") && pr.growthOf100Data;

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
                    <GrowthOf100Table growthData={pr.growthOf100Data} bmGrowthData={pr.bmGrowthOf100Data} productName={productResult.productName} bmName={productResult.benchmarkNames?.[0]} />
                  )}
                  {(viewMode === "chart" || viewMode === "both") && (
                    <div className={viewMode === "both" ? "mt-4" : ""}>
                      <GrowthOf100Chart growthData={pr.growthOf100Data} bmGrowthData={pr.bmGrowthOf100Data} productName={productResult.productName} bmName={productResult.benchmarkNames?.[0]} />
                    </div>
                  )}
                </PdfBlock>
              );
            }

            if (tableOrientation === "horizontal" && viewMode === "table") return null;

            return (
              <PdfBlock key={pri} filename={`${analysis?.name || 'Analysis'}-${pr.window.label}-${attributes.join('-').slice(0, 40)}.pdf`} meta={buildMeta(productResult, catResult, pr)} className="mb-4">
                {(viewMode === "table" || viewMode === "both") && tableOrientation === "vertical" && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{pr.window.label}</span>
                        <span className="text-[10px] text-gray-400 capitalize">{pr.window.type}</span>
                        {shouldAnnualize(pr.window) && <span className="text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">Ann.</span>}
                      </div>
                    </div>
                    <PeriodResultTable periodResult={pr} attributes={attributes} productName={productResult.productName} bmNames={productResult.benchmarkNames} returnType={productResult.returnType} includeCloneProduct={includeCloneProduct} />
                  </>
                )}
                {(viewMode === "chart" || viewMode === "both") && attributes.length > 0 && (
                  <div className={viewMode === "both" ? "mt-4" : ""}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{pr.window.label}</span>
                        <span className="text-[10px] text-gray-400 capitalize">{pr.window.type}</span>
                        {shouldAnnualize(pr.window) && <span className="text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">Ann.</span>}
                      </div>
                      <button onClick={() => toggleChartType(chartKey, pr)} className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-xs">
                        {getChartType(chartKey, pr) === "bar" ? <><TrendingUp className="w-3.5 h-3.5" /> Line</> : <><BarChart2 className="w-3.5 h-3.5" /> Bar</>}
                      </button>
                    </div>
                    {(() => {
                      const chartData = attributes.map(attr => ({
                        attr,
                        product: pr.attributeValues?.[attr] ?? null,
                        benchmark: pr.bmValues?.[attr] ?? null,
                        excess: (pr.attributeValues?.[attr] != null && pr.bmValues?.[attr] != null) ? pr.attributeValues[attr] - pr.bmValues[attr] : null,
                      }));
                      return (
                        <ResponsiveContainer width="100%" height={Math.max(180, attributes.length * 28)}>
                          <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                            <XAxis type="number" tickFormatter={v => isRatioMetric(attributes[0]) ? v?.toFixed(1) : `${v?.toFixed(1)}%`} tick={{ fontSize: 9 }} />
                            <YAxis type="category" dataKey="attr" tick={{ fontSize: 9 }} width={130} />
                            <Tooltip formatter={(v, name) => [fmt(v, name === "excess" ? "Excess Return" : "Return"), name]} />
                            <Legend />
                            <ReferenceLine x={0} stroke="#e5e7eb" />
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

          {viewMode !== "table" && catResult.periodResults.filter(pr => !pr.isRolling && !pr.isHistorical).length > 1 && (
            <PdfBlock filename={`${analysis?.name || 'Analysis'}-Cross-Period.pdf`} meta={buildMeta(productResult, catResult, { window: { label: 'Cross-Period Comparison' } })} className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cross-Period Comparison</p>
              {Object.keys(catResult.periodResults.find(pr => !pr.isRolling && !pr.isHistorical)?.attributeValues || {}).slice(0, 3).map(attr => (
                <div key={attr} className="mb-4">
                  <p className="text-xs font-medium text-gray-600 mb-1">{attr}</p>
                  <AttributeBarChart periodResults={catResult.periodResults} attribute={attr} productNames={[productResult.productName]} bmNames={productResult.benchmarkNames} />
                </div>
              ))}
            </PdfBlock>
          )}
        </SectionToggle>
      ))}
    </div>
  );
}