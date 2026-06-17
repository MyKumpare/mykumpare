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

// Mock calculation functions - these would be replaced with actual calculations
const calculateMetrics = (product, benchmark, periodStart, periodEnd, selectedAttributes) => {
  // This is a placeholder - actual calculations would use the return data
  const metrics = {};
  
  selectedAttributes.forEach(attr => {
    // Generate mock values for demonstration
    const mockValue = Math.random() * 20 - 5; // Random between -5 and 15
    metrics[attr] = mockValue;
  });
  
  return metrics;
};

export default function AnalysisResults({ analysis, products, benchmarks, returnSeries }) {
  const [viewMode, setViewMode] = useState(
    analysis?.measurement_type?.view_mode || "table"
  );
  const [chartTypes, setChartTypes] = useState({}); // { [attr]: 'bar' | 'line' }

  const selectedTypes = analysis?.measurement_type?.selected_types || [];
  const selectedAttributes = analysis?.measurement_type?.attributes || [];

  const toggleChartType = (attr) => {
    setChartTypes((prev) => ({
      ...prev,
      [attr]: prev[attr] === 'line' ? 'bar' : 'line',
    }));
  };

  // Calculate results for each product
  const results = useMemo(() => {
    if (!analysis?.product_configs) return [];

    return analysis.product_configs.map((config) => {
      const product = products?.find((p) => p.id === config.product_id);
      const benchmarks_data = config.benchmark_ids?.map((id) =>
        benchmarks?.find((b) => b.id === id)
      ).filter(Boolean) || [];
      
      const series = returnSeries?.filter((s) => s.product_id === config.product_id) || [];
      
      // Calculate metrics for this product
      const metrics = calculateMetrics(
        product,
        benchmarks_data[0],
        analysis.period_start,
        analysis.period_end,
        selectedAttributes
      );

      return {
        productName: config.product_name,
        firmName: config.firm_name,
        benchmarkNames: config.benchmark_names || [],
        returnType: config.return_type,
        metrics,
      };
    });
  }, [analysis, products, benchmarks, returnSeries, selectedAttributes]);

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
        <h3 className="text-lg font-semibold text-gray-800">Analysis Results</h3>
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
        </div>
      </div>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div>
                        <div className="text-gray-800">{result.productName}</div>
                        {result.firmName && (
                          <div className="text-xs text-gray-500">{result.firmName}</div>
                        )}
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
          {selectedAttributes.map((attr) => {
            const chartType = chartTypes[attr] || 'bar';
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
                      <Bar dataKey={(data) => data.metrics[attr]} fill="#4F46E5">
                        {results.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.metrics[attr] < 0 ? "#DC2626" : "#10B981"}
                          />
                        ))}
                      </Bar>
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
                        stroke="#4F46E5"
                        strokeWidth={2}
                        dot={{ fill: '#4F46E5', strokeWidth: 2 }}
                      />
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