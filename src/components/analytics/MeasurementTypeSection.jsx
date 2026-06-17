import React, { useState } from "react";
import { ChevronDown, ChevronUp, BarChart2 } from "lucide-react";

const MEASUREMENT_TYPES = {
  performance: {
    label: "Performance",
    attributes: [
      "Return",
      "Cumulative Return",
      "Excess Return",
      "Cumulative Excess Return",
      "Excess Return Geometric",
      "Average Return",
      "Average Positive Return",
      "Average Negative Return",
      "Growth of $100",
      "Best Period",
      "Worst Period",
      "Number of Consecutive Periods",
      "Number of Consecutive Negative Periods",
      "Down Period Percent",
      "Up Period Percent",
      "Percent Profitable Period",
      "Manager Consistency",
      "Number of Observations",
      "Periods Above the Benchmark",
      "Percentage Above the Benchmark"
    ]
  },
  risk: {
    label: "Risk and Regression",
    attributes: [
      "Standard Deviation",
      "Downside Deviation",
      "Variance",
      "Skewness",
      "Kurtosis",
      "Information Ratio",
      "Sharpe Ratio",
      "Sortino Ratio",
      "Beta",
      "Alpha",
      "R-Squared",
      "Tracking Error",
      "Treynor Ratio"
    ]
  },
  efficiency: {
    label: "Efficiency",
    attributes: [
      "Efficiency Ratio",
      "Calmar Ratio",
      "Sterling Ratio",
      "Burke Ratio",
      "Pain Index",
      "Pain Ratio"
    ]
  },
  valueAtRisk: {
    label: "Value at Risk",
    attributes: [
      "Value at Risk (VaR)",
      "Conditional VaR (CVaR)",
      "Maximum Drawdown",
      "Average Drawdown",
      "Drawdown Duration",
      "Recovery Factor"
    ]
  },
  population: {
    label: "Population Calculations",
    attributes: [
      "Population Variance",
      "Population Standard Deviation",
      "Population Skewness",
      "Population Kurtosis"
    ]
  }
};

export default function MeasurementTypeSection({ 
  measurementType, 
  setMeasurementType 
}) {
  const [expanded, setExpanded] = useState({
    main: true,
    performance: false,
    risk: false,
    efficiency: false,
    valueAtRisk: false,
    population: false,
  });

  const toggleMeasurementType = (type) => {
    const current = measurementType?.selected_types || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setMeasurementType((prev) => ({ 
      ...prev, 
      selected_types: updated,
      // Clear attributes when deselecting a type
      attributes: current.includes(type) 
        ? (prev.attributes || {}).filter(a => !MEASUREMENT_TYPES[type].attributes.includes(a))
        : prev.attributes
    }));
  };

  const toggleAttribute = (attribute) => {
    const current = measurementType?.attributes || [];
    const updated = current.includes(attribute)
      ? current.filter((a) => a !== attribute)
      : [...current, attribute];
    setMeasurementType((prev) => ({ ...prev, attributes: updated }));
  };

  const selectAllAttributes = (typeKey) => {
    const attrs = MEASUREMENT_TYPES[typeKey].attributes;
    setMeasurementType((prev) => ({ 
      ...prev, 
      attributes: [...new Set([...(prev.attributes || []), ...attrs])] 
    }));
  };

  const clearAllAttributes = (typeKey) => {
    const attrs = MEASUREMENT_TYPES[typeKey].attributes;
    setMeasurementType((prev) => ({ 
      ...prev, 
      attributes: (prev.attributes || []).filter(a => !attrs.includes(a)) 
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-gray-500" />
        <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Measurement Type</label>
      </div>

      {/* Main Measurement Type Selection */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((prev) => ({ ...prev, main: !prev.main }))}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Select Measurement Categories</span>
            {(measurementType?.selected_types || []).length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                {(measurementType?.selected_types || []).length} selected
              </span>
            )}
          </div>
          {expanded.main ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {expanded.main && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {Object.entries(MEASUREMENT_TYPES).map(([key, { label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleMeasurementType(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    (measurementType?.selected_types || []).includes(key)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attribute Selection for Each Selected Type */}
      {(measurementType?.selected_types || []).map((typeKey) => (
        <div key={typeKey} className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((prev) => ({ ...prev, [typeKey]: !prev[typeKey] }))}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">{MEASUREMENT_TYPES[typeKey].label} - Attributes</span>
              {(() => {
                const typeAttrs = MEASUREMENT_TYPES[typeKey].attributes;
                const selectedCount = (measurementType?.attributes || []).filter(a => typeAttrs.includes(a)).length;
                return selectedCount > 0 ? (
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                    {selectedCount} selected
                  </span>
                ) : null;
              })()}
            </div>
            {expanded[typeKey] ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expanded[typeKey] && (
            <div className="p-4 border-t border-gray-200 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectAllAttributes(typeKey)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => clearAllAttributes(typeKey)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {MEASUREMENT_TYPES[typeKey].attributes.map((attr) => (
                  <button
                    key={attr}
                    type="button"
                    onClick={() => toggleAttribute(attr)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      (measurementType?.attributes || []).includes(attr)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                    }`}
                  >
                    {attr}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* View Mode Toggle */}
      {(measurementType?.selected_types || []).length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4">
          <label className="text-sm font-semibold text-gray-700 block mb-2">View Mode</label>
          <div className="flex gap-2">
            {["table", "chart", "both"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMeasurementType((prev) => ({ ...prev, view_mode: mode }))}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  measurementType?.view_mode === mode
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}