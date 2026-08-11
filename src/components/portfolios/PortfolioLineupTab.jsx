import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function formatCurrencyFull(v) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatPct(v) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// Check if a manager is active as of a given date (inclusive of inception and termination)
function isActiveAsOf(inceptionDate, terminationDate, dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (inceptionDate && new Date(inceptionDate) > d) return false;
  if (terminationDate && new Date(terminationDate) < d) return false;
  return true;
}

export default function PortfolioLineupTab({ portfolio }) {
  const historicalAum = portfolio.historical_aum || [];
  const [selectedDate, setSelectedDate] = useState("");

  // Collect all unique month-end dates from historical AUM, sorted ascending
  const availableDates = useMemo(() => {
    const dates = new Set();
    historicalAum.forEach((a) => {
      if (a.date) dates.add(a.date);
    });
    return Array.from(dates).sort((a, b) => new Date(a) - new Date(b));
  }, [historicalAum]);

  // Default to the most recent date with data
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  // The previous period (for MoM performance)
  const prevDate = useMemo(() => {
    if (!selectedDate) return null;
    const idx = availableDates.indexOf(selectedDate);
    return idx > 0 ? availableDates[idx - 1] : null;
  }, [selectedDate, availableDates]);

  // The first period (for since-inception performance)
  const firstDate = availableDates.length > 0 ? availableDates[0] : null;

  // Look up AUM value for a level/refId on a specific date
  const getAum = (level, refId, date) => {
    if (!date) return null;
    const entry = historicalAum.find(
      (a) => a.date === date && a.level === level && (a.reference_id || "") === (refId || "")
    );
    return entry ? entry.value : null;
  };

  // Compute performance between two values
  const calcPerf = (current, prior) => {
    if (current == null || prior == null || prior === 0) return null;
    return ((current - prior) / Math.abs(prior)) * 100;
  };

  // Build the lineup rows for the selected period
  const rows = useMemo(() => {
    if (!selectedDate) return [];
    const result = [];

    // ── Portfolio level ──
    const portfolioMV = getAum("portfolio", "", selectedDate);
    const portfolioMVPrev = getAum("portfolio", "", prevDate);
    const portfolioMVFirst = getAum("portfolio", "", firstDate);
    const benchmarkParts = [];
    if (portfolio.primary_benchmark_name) benchmarkParts.push(portfolio.primary_benchmark_name);
    (portfolio.secondary_benchmarks || []).forEach((b) => {
      if (b.benchmark_name) benchmarkParts.push(b.benchmark_name);
    });

    result.push({
      level: "Portfolio",
      name: portfolio.portfolio_name || "Portfolio Total",
      benchmark: benchmarkParts.length > 0 ? benchmarkParts.join(", ") : "—",
      marketValue: portfolioMV,
      pctOfTotal: portfolioMV != null ? 100 : null,
      inceptionDate: portfolio.inception_date,
      perfMoM: calcPerf(portfolioMV, portfolioMVPrev),
      perfSinceInception: calcPerf(portfolioMV, portfolioMVFirst),
      isHeader: true,
      indent: 0,
    });

    // ── Advisor (MoM or IM) level ──
    if (portfolio.advisor_type && portfolio.advisor_firm_id) {
      const active = isActiveAsOf(
        portfolio.advisor_inception_date,
        portfolio.advisor_termination_date,
        selectedDate
      );
      if (active) {
        const advisorMV = getAum("advisor", portfolio.advisor_firm_id, selectedDate);
        const advisorMVPrev = getAum("advisor", portfolio.advisor_firm_id, prevDate);
        const advisorMVFirst = getAum("advisor", portfolio.advisor_firm_id, firstDate);
        result.push({
          level: portfolio.advisor_type === "Manager of Managers" ? "Manager of Managers" : "Investment Manager",
          name: portfolio.advisor_firm_name || "—",
          benchmark: "—",
          marketValue: advisorMV,
          pctOfTotal: advisorMV != null && portfolioMV ? (advisorMV / portfolioMV) * 100 : null,
          inceptionDate: portfolio.advisor_inception_date,
          perfMoM: calcPerf(advisorMV, advisorMVPrev),
          perfSinceInception: calcPerf(advisorMV, advisorMVFirst),
          isHeader: false,
          indent: 1,
        });
      }
    }

    // ── Sub-managers (only for MoM) ──
    if (portfolio.advisor_type === "Manager of Managers") {
      (portfolio.sub_managers || []).forEach((sm) => {
        const active = isActiveAsOf(sm.inception_date, sm.termination_date, selectedDate);
        if (active) {
          const smMV = getAum("sub_manager", sm.product_id, selectedDate);
          const smMVPrev = getAum("sub_manager", sm.product_id, prevDate);
          const smMVFirst = getAum("sub_manager", sm.product_id, firstDate);
          result.push({
            level: "Sub-Manager",
            name: sm.product_name || "—",
            firmName: sm.firm_name,
            benchmark: "—",
            marketValue: smMV,
            pctOfTotal: smMV != null && portfolioMV ? (smMV / portfolioMV) * 100 : null,
            inceptionDate: sm.inception_date,
            perfMoM: calcPerf(smMV, smMVPrev),
            perfSinceInception: calcPerf(smMV, smMVFirst),
            isHeader: false,
            indent: 2,
          });
        }
      });
    }

    return result;
  }, [selectedDate, prevDate, firstDate, portfolio, historicalAum]);

  if (availableDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm text-gray-500 font-medium">No Historical AUM Data</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Add AUM data points in the Historical AUM tab to see the manager line-up by period.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">Month-End Period:</span>
        </div>
        <Select value={selectedDate} onValueChange={setSelectedDate}>
          <SelectTrigger className="w-48 h-8 text-sm">
            <SelectValue placeholder="Select period..." />
          </SelectTrigger>
          <SelectContent>
            {availableDates.slice().reverse().map((d) => (
              <SelectItem key={d} value={d}>
                {format(parseISO(d), "MM/dd/yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">
          {availableDates.length} period{availableDates.length !== 1 ? "s" : ""} available
          {firstDate && selectedDate === availableDates[availableDates.length - 1]
            ? " · Most recent"
            : selectedDate === firstDate
            ? " · Since inception"
            : ""}
        </span>
      </div>

      {/* Lineup table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">Level / Name</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">Benchmark</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">Market Value</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">% of Total</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">MoM Perf</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">Since Inception</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap">Inception Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-t border-gray-100",
                  row.isHeader ? "bg-indigo-50/40 font-semibold" : "hover:bg-gray-50/50"
                )}
              >
                <td className="px-3 py-2">
                  <div style={{ paddingLeft: `${row.indent * 20}px` }}>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight">{row.level}</div>
                    <div className="text-gray-900 leading-tight">{row.name}</div>
                    {row.firmName && <div className="text-xs text-gray-400 leading-tight">{row.firmName}</div>}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600 text-xs align-top">{row.benchmark}</td>
                <td className="px-3 py-2 text-right text-gray-900 font-medium whitespace-nowrap align-top">
                  {row.marketValue != null ? formatCurrencyFull(row.marketValue) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap align-top">
                  {row.pctOfTotal != null ? `${row.pctOfTotal.toFixed(1)}%` : "—"}
                </td>
                <td className={cn(
                  "px-3 py-2 text-right font-medium whitespace-nowrap align-top",
                  row.perfMoM != null ? (row.perfMoM >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"
                )}>
                  {formatPct(row.perfMoM)}
                </td>
                <td className={cn(
                  "px-3 py-2 text-right font-medium whitespace-nowrap align-top",
                  row.perfSinceInception != null ? (row.perfSinceInception >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"
                )}>
                  {formatPct(row.perfSinceInception)}
                </td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap align-top">
                  {row.inceptionDate ? format(parseISO(row.inceptionDate), "MM/dd/yyyy") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Only managers active as of the selected period are shown. Performance is based on market value change (not time-weighted returns).
      </p>
    </div>
  );
}