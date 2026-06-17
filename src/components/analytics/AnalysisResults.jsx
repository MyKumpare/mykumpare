import React, { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, LayoutList, LineChart as LineChartIcon } from "lucide-react";

// Helper to format numbers
const formatNumber = (num) => {
  if (num === null || num === undefined) return "N/A";
  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(2) + "M";
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(2) + "K";
  return num.toFixed(2);
};

const formatPercent = (num) => {
  if (num === null || num === undefined) return "N/A";
  return num.toFixed(2) + "%";
};

// Calculate metrics for a specific attribute and period configuration
const calculateAttributeMetrics = (product, benchmark, periodStart, periodEnd, attribute, measurementPeriods) => {
  // This would use actual return series data and calculate based on measurement periods
  // For now, generating mock values that would come from real calculations
  const mockValue = Math.random() * 20 - 5;
  return mockValue;
};

const calculateBenchmarkAttributeMetrics = (benchmark, periodStart, periodEnd, attribute, measurementPeriods) => {
  const mockValue = Math.random() * 15 - 3;
  return mockValue;
};

const calculateExcessReturn = (productValue, benchmarkValue) => {
  return productValue - benchmarkValue;
};

export default function AnalysisResults({ analysis, products, benchmarks, returnSeries }) {
  const [viewMode, setViewMode] = useState(
    analysis?.measurement_type?.view_mode || "table"
  );
  const [chartTypes, setChartTypes] = useState({}); // { [attr]: 'bar' | 'line' }
  const [showBenchmarks, setShowBenchmarks] = useState({}); // { [productIndex]: boolean }

  const selectedTypes = analysis?.measurement_type?.selected_types || [];
  const selectedAttributes = analysis?.measurement_type?.attributes || [];
  const measurementPeriods = analysis?.measurement_periods || {};

  const toggleChartType = (attr) => {
    setChartTypes((prev) => ({
      ...prev,
      [attr]: prev[attr] === 'line' ? 'bar' : 'line',
    }));
  };

  const toggleBenchmarkVisibility = (index) => {
    setShowBenchmarks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Format analysis period display
  const formatPeriod = (dateStr) => {
    if (!dateStr) return 'N/A';
    return dateStr;
  };

  // Calculate results for each product and each attribute separately
  const results = useMemo(() => {
    if (!analysis?.product_configs) return [];

    return analysis.product_configs.map((config, index) => {
      const product = products?.find((p) => p.id === config.product_id);
      const benchmarks_data = config.benchmark_ids?.map((id) =>
        benchmarks?.find((b) => b.id === id)
      ).filter(Boolean) || [];
      
      const series = returnSeries?.filter((s) => s.product_id === config.product_id) || [];
      
      // Calculate metrics for each attribute separately based on measurement periods
      const productMetrics = {};
      const benchmarkMetrics = {};
      const excessMetrics = {};
      
      selectedAttributes.forEach(attr => {
        // Calculate product metric for this specific attribute
        productMetrics[attr] = calculateAttributeMetrics(
          product,
          benchmarks_data[0],
          analysis.period_start,
          analysis.period_end,
          attr,
          measurementPeriods
        );
        
        // Calculate benchmark metric if benchmarks exist
        if (benchmarks_data.length > 0) {
          benchmarkMetrics[attr] = calculateBenchmarkAttributeMetrics(
            benchmarks_data[0],
            analysis.period_start,
            analysis.period_end,
            attr,
            measurementPeriods
          );
          
          // Calculate excess return for this attribute
          excessMetrics[attr] = calculateExcessReturn(productMetrics[attr], benchmarkMetrics[attr]);
        }
      });

      return {
        productName: config.product_name,
        firmName: config.firm_name,
        benchmarkNames: config.benchmark_names || [],
        returnType: config.return_type,
        metrics: productMetrics,
        benchmarkMetrics: benchmarks_data.length > 0 ? benchmarkMetrics : null,
        excessMetrics: benchmarks_data.length > 0 ? excessMetrics : null,
        showBenchmark: showBenchmarks[index] || false,
      };
    });
  }, [analysis, products, benchmarks, returnSeries, selectedAttributes, measurementPeriods, showBenchmarks]);

  if (!analysis || results.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No analysis results to display.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Analysis Results</h3>
          {analysis?.period_start || analysis?.period_end ? (
            <p className="text-xs text-gray-500 mt-1">
              {formatPeriod(analysis.period_start)} to {formatPeriod(analysis.period_end)}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              viewMode === "table" || viewMode === "both"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            Table
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              viewMode === "chart" || viewMode === "both"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Chart
          </button>
          <button
            onClick={() => setViewMode("both")}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              viewMode === "both"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
            }`}
          >
            <span className="text-xs font-medium">Both</span>
          </button>
        </div>
      </div>

      {/* Measurement Periods Summary */}
      {(measurementPeriods?.trailing_periods?.length > 0 ||
        measurementPeriods?.rolling_periods?.length > 0 ||
        measurementPeriods?.calendar_years?.length > 0 ||
        measurementPeriods?.historical_periods?.length > 0 ||
        measurementPeriods?.include_cumulative) && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 mb-2">Measurement Periods</h4>
          <div className="flex flex-wrap gap-2">
            {measurementPeriods.trailing_periods?.length > 0 && (
              <div className="text-xs">
                <span className="font-medium text-gray-700">Trailing:</span>
                <span className="text-gray-600 ml-1">{measurementPeriods.trailing_periods.join(', ')}</span>
              </div>
            )}
            {measurementPeriods.rolling_periods?.length > 0 && (
              <div className="text-xs">
                <span className="font-medium text-gray-700">Rolling:</span>
                <span className="text-gray-600 ml-1">{measurementPeriods.rolling_periods.join(', ')}</span>
              </div>
            )}
            {measurementPeriods.calendar_years?.length > 0 && (
              <div className="text-xs">
                <span className="font-medium text-gray-700">Calendar Years:</span>
                <span className="text-gray-600 ml-1">{measurementPeriods.calendar_years.join(', ')}</span>
              </div>
            )}
            {measurementPeriods.historical_periods?.length > 0 && (
              <div className="text-xs">
                <span className="font-medium text-gray-700">Historical:</span>
                <span className="text-gray-600 ml-1">{measurementPeriods.historical_periods.join(', ')}</span>
              </div>
            )}
            {measurementPeriods.include_cumulative && (
              <div className="text-xs">
                <span className="font-medium text-gray-700">Cumulative</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table View */}
      {(viewMode === "table" || viewMode === "both") && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Product</TableHead>
                  <TableHead className="font-semibold text-gray-700">Benchmark</TableHead>
                  {selectedAttributes.map((attr) => (
                    <TableHead key={attr} className="font-semibold text-gray-700 text-right">
                      {attr}
                    </TableHead>
                  ))}
                  {results.some(r => r.showBenchmark) && (
                    <>
                      <TableHead className="font-semibold text-gray-700 text-right">Benchmark Return</TableHead>
                      <TableHead className="font-semibold text-gray-700 text-right">Excess Return</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBenchmarkVisibility(idx)}
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            result.showBenchmark ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                          }`}
                          title={result.showBenchmark ? "Hide benchmark" : "Show benchmark"}
                        >
                          {result.showBenchmark && (
                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                        <div>
                          <div className="text-gray-800">{result.productName}</div>
                          {result.firmName && (
                            <div className="text-xs text-gray-500">{result.firmName}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {result.benchmarkNames.join(", ") || "N/A"}
                    </TableCell>
                    {selectedAttributes.map((attr) => (
                      <TableCell key={attr} className="text-right">
                        <span
                          className={`font-medium ${
                            result.metrics[attr] < 0 ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {formatPercent(result.metrics[attr])}
                        </span>
                      </TableCell>
                    ))}
                    {result.showBenchmark && (
                      <>
                        <TableCell className="text-right">
                          {result.benchmarkMetrics ? (
                            <span className={`font-medium ${
                              result.benchmarkMetrics[selectedAttributes[0]] < 0 ? "text-red-600" : "text-green-600"
                            }`}>
                              {formatPercent(result.benchmarkMetrics[selectedAttributes[0]] || 0)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {result.excessMetrics ? (
                            <span className={`font-medium ${
                              result.excessMetrics[selectedAttributes[0]] < 0 ? "text-red-600" : "text-green-600"
                            }`}>
                              {formatPercent(result.excessMetrics[selectedAttributes[0]] || 0)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Chart View */}
      {(viewMode === "chart" || viewMode === "both") && (
        <div className="space-y-6">
          {/* Separate chart for each attribute */}
          {selectedAttributes.map((attr) => {
            const chartType = chartTypes[attr] || 'bar';
            const showBenchmarkInChart = results.some(r => r.showBenchmark);
            return (
              <div key={attr} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">{attr}</h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setChartTypes((prev) => ({ ...prev, [attr]: 'bar' }))}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        chartType === 'bar'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}
                      title="Bar Chart"
                    >
                      <BarChart2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setChartTypes((prev) => ({ ...prev, [attr]: 'line' }))}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        chartType === 'line'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}
                      title="Line Chart"
                    >
                      <LineChartIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  {chartType === 'bar' ? (
                    <BarChart data={results}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="productName" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value) => [formatPercent(value), attr]}
                        labelFormatter={(label) => `Product: ${label}`}
                      />
                      <Legend />
                      <Bar dataKey={(data) => data.metrics[attr]} name={`${attr} - Product`} fill="#4F46E5">
                        {results.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.metrics[attr] < 0 ? "#DC2626" : "#10B981"}
                          />
                        ))}
                      </Bar>
                      {showBenchmarkInChart && (
                        <Bar dataKey={(data) => data.showBenchmark ? (data.benchmarkMetrics?.[attr] || 0) : null} name={`${attr} - Benchmark`} fill="#F59E0B">
                          {results.map((entry, index) => (
                            <Cell
                              key={`bench-cell-${index}`}
                              fill={entry.showBenchmark ? (entry.benchmarkMetrics?.[attr] < 0 ? "#DC2626" : "#10B981") : "transparent"}
                            />
                          ))}
                        </Bar>
                      )}
                    </BarChart>
                  ) : (
                    <LineChart data={results}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="productName" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value) => [formatPercent(value), attr]}
                        labelFormatter={(label) => `Product: ${label}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey={(data) => data.metrics[attr]}
                        name={`${attr} - Product`}
                        stroke="#4F46E5"
                        strokeWidth={2}
                        dot={{ fill: '#4F46E5', strokeWidth: 2 }}
                      />
                      {showBenchmarkInChart && (
                        <Line
                          type="monotone"
                          dataKey={(data) => data.showBenchmark ? (data.benchmarkMetrics?.[attr] || 0) : null}
                          name={`${attr} - Benchmark`}
                          stroke="#F59E0B"
                          strokeWidth={2}
                          dot={{ fill: '#F59E0B', strokeWidth: 2 }}
                        />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}