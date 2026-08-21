import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { GitCompare, TrendingUp, Package, Users, X } from "lucide-react";
import AumGrowthChart from "@/components/shared/AumGrowthChart";
import FirmCompareSelector from "@/components/firms/FirmCompareSelector";
import FirmCompareProducts from "@/components/firms/FirmCompareProducts";
import FirmCompareClientTypes from "@/components/firms/FirmCompareClientTypes";
import ReportDateRangePicker from "@/components/reports/ReportDateRangePicker";

function Placeholder() {
  return (
    <div className="border border-dashed border-gray-200 rounded-xl bg-gray-50 h-48 flex items-center justify-center text-sm text-gray-400">
      Select a firm
    </div>
  );
}

export default function FirmComparison() {
  const navigate = useNavigate();
  const [firmAId, setFirmAId] = useState("");
  const [firmBId, setFirmBId] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list(),
  });

  const firmA = firms.find((f) => f.id === firmAId);
  const firmB = firms.find((f) => f.id === firmBId);

  const availableRange = useMemo(() => {
    const dates = [];
    for (const f of [firmA, firmB].filter(Boolean)) {
      for (const row of f.aum_history || []) {
        if (row.month_end_date) dates.push(row.month_end_date);
      }
    }
    dates.sort();
    return dates.length ? { oldest: dates[0], newest: dates[dates.length - 1] } : null;
  }, [firmA, firmB]);

  const filterRows = (rows) => {
    const { start, end } = dateRange;
    if (!start && !end) return rows || [];
    return (rows || []).filter((r) => {
      if (!r.month_end_date) return false;
      if (start && r.month_end_date < start) return false;
      if (end && r.month_end_date > end) return false;
      return true;
    });
  };

  const productsA = useMemo(
    () => products.filter((p) => p.firm_id === firmAId && !p.deleted_at),
    [products, firmAId]
  );
  const productsB = useMemo(
    () => products.filter((p) => p.firm_id === firmBId && !p.deleted_at),
    [products, firmBId]
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
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

      {/* Selectors */}
      <div className="flex flex-col md:flex-row gap-3">
        <FirmCompareSelector
          label="Firm A"
          firms={firms}
          value={firmAId}
          onChange={setFirmAId}
          excludeId={firmBId}
        />
        <FirmCompareSelector
          label="Firm B"
          firms={firms}
          value={firmBId}
          onChange={setFirmBId}
          excludeId={firmAId}
        />
      </div>

      {(firmA || firmB) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
          <ReportDateRangePicker value={dateRange} onChange={setDateRange} availableRange={availableRange} label="Filter AUM history by month-end date" />
        </div>
      )}

      {!firmA && !firmB ? (
        <div className="text-center py-16 text-gray-400">
          <GitCompare className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            Select two firms to compare their AUM trends, products, and client type allocations.
          </p>
        </div>
      ) : firmsLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading firms…</div>
      ) : (
        <>
          {/* AUM Trends */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700">AUM Trends</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {firmA ? (
                <AumGrowthChart rows={filterRows(firmA.aum_history)} entityLabel="Firm" name={firmA.name} />
              ) : (
                <Placeholder />
              )}
              {firmB ? (
                <AumGrowthChart rows={filterRows(firmB.aum_history)} entityLabel="Firm" name={firmB.name} />
              ) : (
                <Placeholder />
              )}
            </div>
          </section>

          {/* Product List */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700">Product List</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-xl p-4 bg-white shadow-sm">
                {firmA ? <FirmCompareProducts products={productsA} /> : <Placeholder />}
              </div>
              <div className="border rounded-xl p-4 bg-white shadow-sm">
                {firmB ? <FirmCompareProducts products={productsB} /> : <Placeholder />}
              </div>
            </div>
          </section>

          {/* Client Type Allocations */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-700">Client Type Allocations</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-xl p-4 bg-white shadow-sm">
                {firmA ? <FirmCompareClientTypes firm={firmA} /> : <Placeholder />}
              </div>
              <div className="border rounded-xl p-4 bg-white shadow-sm">
                {firmB ? <FirmCompareClientTypes firm={firmB} /> : <Placeholder />}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}