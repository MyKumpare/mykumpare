import React, { useState, useEffect, useMemo } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

// Helper to get month-end date
const toMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  if (ymStr.includes("/")) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${String(month).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${year}`;
};

const getPriorMonthEnd = (ymStr) => {
  if (!ymStr) return "";
  if (ymStr.includes("/")) return ymStr;
  const [year, month] = ymStr.split("-").map(Number);
  let priorYear = year;
  let priorMonth = month - 1;
  if (priorMonth === 0) {
    priorMonth = 12;
    priorYear = year - 1;
  }
  const lastDay = new Date(priorYear, priorMonth, 0).getDate();
  return `${String(priorMonth).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}/${priorYear}`;
};

const isMDYFormat = (str) => str && typeof str === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(str);

export default function MeasurementPeriodsSection({ 
  measurementPeriods, 
  setMeasurementPeriods, 
  periodStart, 
  periodEnd,
  allSeries,
  selectedProductIds,
  benchmarks 
}) {
  const [expanded, setExpanded] = useState({
    trailing: true,
    rolling: false,
    cumulative: false,
    calendar: false,
  });

  const [trailingCustomStart, setTrailingCustomStart] = useState("");
  const [trailingCustomEnd, setTrailingCustomEnd] = useState("");
  const [rollingCustomStart, setRollingCustomStart] = useState("");
  const [rollingCustomEnd, setRollingCustomEnd] = useState("");

  // Initialize from saved measurementPeriods
  useEffect(() => {
    if (measurementPeriods) {
      setTrailingCustomStart(measurementPeriods.trailing_custom_start || "");
      setTrailingCustomEnd(measurementPeriods.trailing_custom_end || "");
      setRollingCustomStart(measurementPeriods.rolling_custom_start || "");
      setRollingCustomEnd(measurementPeriods.rolling_custom_end || "");
    }
  }, [measurementPeriods]);

  // Calculate available calendar years based on common period
  const availableCalendarYears = React.useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    
    // Parse MM/DD/YYYY
    const parseMDY = (mdy) => {
      const [m, d, y] = mdy.split("/").map(Number);
      return new Date(y, m - 1, d);
    };
    
    const start = parseMDY(periodStart);
    const end = parseMDY(periodEnd);
    
    const years = [];
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      years.push(y);
    }
    return years;
  }, [periodStart, periodEnd]);

  const toggleTrailingPeriod = (period) => {
    const current = measurementPeriods?.trailing_periods || [];
    const updated = current.includes(period)
      ? current.filter((p) => p !== period)
      : [...current, period];
    setMeasurementPeriods((prev) => ({ ...prev, trailing_periods: updated }));
  };

  const toggleRollingPeriod = (period) => {
    const current = measurementPeriods?.rolling_periods || [];
    const updated = current.includes(period)
      ? current.filter((p) => p !== period)
      : [...current, period];
    setMeasurementPeriods((prev) => ({ ...prev, rolling_periods: updated }));
  };

  const toggleCalendarYear = (year) => {
    const current = measurementPeriods?.calendar_years || [];
    const updated = current.includes(year)
      ? current.filter((y) => y !== year)
      : [...current, year];
    setMeasurementPeriods((prev) => ({ ...prev, calendar_years: updated }));
  };

  const selectAllCalendarYears = () => {
    setMeasurementPeriods((prev) => ({ ...prev, calendar_years: availableCalendarYears }));
  };

  const clearAllCalendarYears = () => {
    setMeasurementPeriods((prev) => ({ ...prev, calendar_years: [] }));
  };

  const SectionHeader = ({ type, label, count }) => (
    <button
      type="button"
      onClick={() => setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))}
      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        {count > 0 && (
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{count} selected</span>
        )}
      </div>
      {expanded[type] ? (
        <ChevronUp className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-gray-500" />
        <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Measurement Periods</label>
      </div>

      {/* Trailing Periods */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader 
          type="trailing" 
          label="Trailing Period" 
          count={(measurementPeriods?.trailing_periods || []).length} 
        />
        {expanded.trailing && (
          <div className="p-4 space-y-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {["1M", "3M", "1Y", "3Y", "5Y", "7Y", "10Y", "since_inception"].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => toggleTrailingPeriod(period)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    (measurementPeriods?.trailing_periods || []).includes(period)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                  }`}
                >
                  {period === "since_inception" ? "Since Inception" : period}
                </button>
              ))}
              <button
                type="button"
                onClick={() => toggleTrailingPeriod("custom")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  (measurementPeriods?.trailing_periods || []).includes("custom")
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                Custom
              </button>
            </div>

            {(measurementPeriods?.trailing_periods || []).includes("custom") && (
              <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <input
                    type="text"
                    value={trailingCustomStart}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                        setTrailingCustomStart(val);
                        setMeasurementPeriods((prev) => ({ ...prev, trailing_custom_start: val }));
                      }
                    }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Start Date</p>
                </div>
                <span className="text-xs text-gray-400">to</span>
                <div>
                  <input
                    type="text"
                    value={trailingCustomEnd}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                        setTrailingCustomEnd(val);
                        setMeasurementPeriods((prev) => ({ ...prev, trailing_custom_end: val }));
                      }
                    }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium">End Date</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rolling Periods */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <SectionHeader 
          type="rolling" 
          label="Rolling Period" 
          count={(measurementPeriods?.rolling_periods || []).length} 
        />
        {expanded.rolling && (
          <div className="p-4 space-y-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {["3M", "6M", "1Y", "3Y", "5Y", "7Y", "10Y"].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => toggleRollingPeriod(period)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    (measurementPeriods?.rolling_periods || []).includes(period)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                  }`}
                >
                  {period}
                </button>
              ))}
              <button
                type="button"
                onClick={() => toggleRollingPeriod("custom")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  (measurementPeriods?.rolling_periods || []).includes("custom")
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                Custom
              </button>
            </div>

            {(measurementPeriods?.rolling_periods || []).includes("custom") && (
              <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <input
                    type="text"
                    value={rollingCustomStart}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                        setRollingCustomStart(val);
                        setMeasurementPeriods((prev) => ({ ...prev, rolling_custom_start: val }));
                      }
                    }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Start Date</p>
                </div>
                <span className="text-xs text-gray-400">to</span>
                <div>
                  <input
                    type="text"
                    value={rollingCustomEnd}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(val) || val === "") {
                        setRollingCustomEnd(val);
                        setMeasurementPeriods((prev) => ({ ...prev, rolling_custom_end: val }));
                      }
                    }}
                    placeholder="MM/DD/YYYY"
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-28"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium">End Date</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cumulative Period */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((prev) => ({ ...prev, cumulative: !prev.cumulative }))}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Cumulative Period</span>
            {measurementPeriods?.include_cumulative && (
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">Selected</span>
            )}
          </div>
          {expanded.cumulative ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {expanded.cumulative && (
          <div className="p-4 border-t border-gray-200">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={measurementPeriods?.include_cumulative || false}
                onChange={(e) => setMeasurementPeriods((prev) => ({ ...prev, include_cumulative: e.target.checked }))}
                className="rounded border-gray-300 text-indigo-600"
              />
              Include cumulative period analysis
            </label>
          </div>
        )}
      </div>

      {/* Calendar Year Periods */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((prev) => ({ ...prev, calendar: !prev.calendar }))}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Calendar Year Period</span>
            {(measurementPeriods?.calendar_years || []).length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                {(measurementPeriods?.calendar_years || []).length} years
              </span>
            )}
          </div>
          {expanded.calendar ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {expanded.calendar && (
          <div className="p-4 border-t border-gray-200 space-y-3">
            {availableCalendarYears.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllCalendarYears}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearAllCalendarYears}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableCalendarYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => toggleCalendarYear(year)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        (measurementPeriods?.calendar_years || []).includes(year)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400">Set analysis period first to see available calendar years</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}