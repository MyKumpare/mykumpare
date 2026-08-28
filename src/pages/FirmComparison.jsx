import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { GitCompare, TrendingUp, BarChart3, Table2, X } from "lucide-react";
import FirmMultiSelector from "@/components/firms/FirmMultiSelector";
import FirmMetricsTable from "@/components/firms/FirmMetricsTable";
import FirmComparisonAumChart from "@/components/firms/FirmComparisonAumChart";
import FirmBenchmarkComparison from "@/components/firms/FirmBenchmarkComparison";
import ReportDateRangePicker from "@/components/reports/ReportDateRangePicker";

export default function FirmComparison() {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });
  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list(),
  });

  const selectedFirms = useMemo(
    () => selectedIds.map((id) => firms.find((f) => f.id === id)).filter(Boolean),
    [selectedIds, firms]
  );

  const availableRange = useMemo(() => {
    const dates = [];
    for (const f of selectedFirms) {
      for (const row of f.aum_history || []) {
        if (row.month_end_date) dates.push(row.month_end_date);
      }
    }
    dates.sort();
    return dates.length
      ? { oldest: dates[0], newest: dates[dates.length - 1] }
      : null;
  }, [selectedFirms]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-800">Firm Comparison</h1>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Firm selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <FirmMultiSelector
          firms={firms}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      </div>

      {/* Date range filter (visible when firms selected) */}
      {selectedFirms.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <ReportDateRangePicker
            value={dateRange}
            onChange={setDateRange}
            availableRange={availableRange}
            label="Filter AUM history by month-end date"
          />
        </div>
      )}

      {/* Empty state */}
      {selectedFirms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GitCompare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            Select multiple firms to compare their key metrics, AUM trends, and
            benchmark data side-by-side.
          </p>
        </div>
      ) : firmsLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Loading firms…
        </div>
      ) : (
        <>
          {/* Key Metrics Table */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Table2 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700">
                Key Metrics
              </h2>
            </div>
            <FirmMetricsTable firms={selectedFirms} products={products} />
          </section>

          {/* AUM Trends */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700">
                AUM Trends
              </h2>
            </div>
            <FirmComparisonAumChart
              firms={selectedFirms}
              dateRange={dateRange}
            />
          </section>

          {/* Benchmark Comparison */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700">
                Benchmark Data
              </h2>
            </div>
            <FirmBenchmarkComparison
              firms={selectedFirms}
              products={products}
              benchmarks={benchmarks}
            />
          </section>
        </>
      )}
    </div>
  );
}