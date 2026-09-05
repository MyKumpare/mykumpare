import React, { useState } from "react";
import { BarChart3, TrendingUp, PieChart, Eye, EyeOff } from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import FirmAumTrendCard from "@/components/dashboard/FirmAumTrendCard";
import FirmCategoryChart from "@/components/dashboard/FirmCategoryChart";

/**
 * Toggleable dashboard charts panel. Users select which chart widgets to
 * display on the dashboard; their choices persist across sessions.
 *
 * Props:
 *  - firms: array of firm records (active, non-deleted)
 */
const CHART_OPTIONS = [
  { key: "aum-trends", label: "AUM & Net Flow Trends", icon: TrendingUp, description: "Firm AUM and net asset flow over time" },
  { key: "firm-category", label: "Firms by Category", icon: BarChart3, description: "Firm distribution by type and database growth" },
];

export default function DashboardChartsPanel({ firms, onClickCategory }) {
  const [visibleCharts, setVisibleCharts] = usePersistentState("dashboard_charts_visible", {
    "aum-trends": true,
    "firm-category": true,
  });
  const [showSelector, setShowSelector] = useState(false);

  const toggleChart = (key) => {
    setVisibleCharts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCount = CHART_OPTIONS.filter((opt) => visibleCharts[opt.key]).length;

  return (
    <div className="mb-4">
      {/* Toggle selector bar */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-700">Dashboard Charts</h3>
          <span className="text-xs text-gray-400">({activeCount} shown)</span>
        </div>
        <button
          onClick={() => setShowSelector((s) => !s)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {showSelector ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showSelector ? "Hide Options" : "Select Charts"}
        </button>
      </div>

      {/* Chart selection pills */}
      {showSelector && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <p className="text-xs text-gray-500 mb-2">Toggle which charts to display on your dashboard:</p>
          <div className="flex flex-wrap gap-2">
            {CHART_OPTIONS.map((opt) => {
              const isActive = visibleCharts[opt.key];
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleChart(opt.key)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                  title={opt.description}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                  {isActive ? <Eye className="w-3 h-3 ml-0.5" /> : <EyeOff className="w-3 h-3 ml-0.5 text-gray-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Render selected charts */}
      {activeCount === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <PieChart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No charts selected. Click "Select Charts" to choose which to display.</p>
        </div>
      ) : (
        <>
          {visibleCharts["aum-trends"] && <FirmAumTrendCard firms={firms} />}
          {visibleCharts["firm-category"] && <FirmCategoryChart firms={firms} onClickCategory={onClickCategory} />}
        </>
      )}
    </div>
  );
}