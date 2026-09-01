import React, { useMemo, useState } from "react";
import { format, parseISO, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Download, Calendar, RotateCcw } from "lucide-react";
import FirmMultiSelector from "@/components/firms/FirmMultiSelector";
import PeerGroupTrendLoader from "@/components/dashboard/PeerGroupTrendLoader";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/usePersistentState";

const MAX_FIRMS = 6;

// Distinct colors for each firm's AUM line. Net flow uses a dashed variant.
const FIRM_COLORS = [
  "#4f46e5", // indigo
  "#0d9488", // teal
  "#dc2626", // red
  "#d97706", // amber
  "#2563eb", // blue
  "#7c3aed", // violet
];

function toNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(String(val).replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function compactCurrency(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

function fullCurrency(v) {
  const n = Number(v) || 0;
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDisplay(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  return isNaN(d.getTime()) ? iso : format(d, "MM/yy");
}

/**
 * Dashboard card: multi-firm AUM history & net flow line chart.
 * Lets the user pick up to 6 firms and overlays each firm's month-end AUM
 * (solid line) and net asset flow (dashed line) on a shared time axis so
 * growth trends can be compared at a glance.
 */
export default function FirmAumTrendCard({ firms = [] }) {
  const [selectedIds, setSelectedIds] = usePersistentState("dash_aum_trend_firms", []);
  const [dateRange, setDateRange] = usePersistentState("dash_aum_trend_daterange", { from: "", to: "" });
  const [showDateFilter, setShowDateFilter] = useState(false);
  const isFiltered = !!(dateRange.from || dateRange.to);

  const selectedFirms = useMemo(
    () => selectedIds.map((id) => firms.find((f) => f.id === id)).filter(Boolean),
    [selectedIds, firms]
  );

  // Merge each selected firm's aum_history into a single dataset keyed by date.
  const { chartData, hasData } = useMemo(() => {
    const dateMap = new Map(); // date -> { date, [firmId_aum]: n, [firmId_flow]: n }

    for (const firm of selectedFirms) {
      const rows = (firm.aum_history || []).filter((r) => r.month_end_date);
      for (const r of rows) {
        const key = r.month_end_date;
        if (!dateMap.has(key)) dateMap.set(key, { date: key });
        const entry = dateMap.get(key);
        entry[`${firm.id}_aum`] = toNumber(r.firm_aum);
        entry[`${firm.id}_flow`] = toNumber(r.net_asset_flows);
      }
    }

    let data = Array.from(dateMap.values()).sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    );

    // Apply date-range filter if set
    if (dateRange.from || dateRange.to) {
      const fromDate = dateRange.from ? startOfDay(parseISO(dateRange.from)) : null;
      const toDate = dateRange.to ? endOfDay(parseISO(dateRange.to)) : null;
      data = data.filter((entry) => {
        if (!entry.date) return false;
        const d = parseISO(entry.date);
        if (fromDate && isBefore(d, fromDate)) return false;
        if (toDate && isAfter(d, toDate)) return false;
        return true;
      });
    }

    return { chartData: data, hasData: data.length > 0 };
  }, [selectedFirms, dateRange]);

  const exportCsv = () => {
    if (!hasData || selectedFirms.length === 0) return;

    const headers = ["Month End Date", ...selectedFirms.flatMap((f) => [`${f.name} - AUM`, `${f.name} - Net Flow`])];
    const rows = chartData.map((entry) => {
      const row = [entry.date];
      for (const firm of selectedFirms) {
        row.push(entry[`${firm.id}_aum`] ?? "");
        row.push(entry[`${firm.id}_flow`] ?? "");
      }
      return row;
    });

    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `firm_aum_trends_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Firm AUM &amp; Net Flow Trends</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={!hasData || selectedFirms.length === 0}
          className="ml-auto h-7 px-2 text-xs gap-1"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FirmMultiSelector
          firms={firms}
          selectedIds={selectedIds}
          onChange={(ids) => setSelectedIds(ids.slice(0, MAX_FIRMS))}
        />
        <PeerGroupTrendLoader
          firms={firms}
          maxFirms={MAX_FIRMS}
          onApply={(ids) => setSelectedIds(ids)}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDateFilter((s) => !s)}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${
              showDateFilter || isFiltered
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "text-gray-600 hover:bg-gray-50 border-gray-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Date Range
            {isFiltered && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px]">
                Active
              </span>
            )}
          </button>
          {isFiltered && (
            <button
              type="button"
              onClick={() => setDateRange({ from: "", to: "" })}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 font-medium"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {showDateFilter && (
        <div className="flex flex-wrap items-center gap-3 mt-2 px-1">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-gray-500 font-medium">From</label>
            <input
              type="date"
              value={dateRange.from}
              max={dateRange.to || undefined}
              onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
              className="h-8 text-xs border border-gray-200 rounded-md px-2 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-gray-500 font-medium">To</label>
            <input
              type="date"
              value={dateRange.to}
              min={dateRange.from || undefined}
              onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
              className="h-8 text-xs border border-gray-200 rounded-md px-2 focus:outline-none focus:border-indigo-400"
            />
          </div>
          {isFiltered && (
            <span className="text-[11px] text-gray-500">
              {dateRange.from ? format(parseISO(dateRange.from), "MMM d, yyyy") : "Start"}
              {" → "}
              {dateRange.to ? format(parseISO(dateRange.to), "MMM d, yyyy") : "End"}
            </span>
          )}
        </div>
      )}

      {selectedFirms.length === 0 ? (
        <div className="mt-4 text-sm text-gray-400 italic text-center py-8 border border-dashed border-gray-200 rounded-xl">
          Select one or more firms above to compare AUM growth and net flow trends.
        </div>
      ) : !hasData ? (
        <div className="mt-4 text-sm text-gray-400 italic text-center py-8 border border-dashed border-gray-200 rounded-xl">
          The selected firm(s) have no AUM history entries yet. Add monthly AUM data
          from a firm's profile to see trends here.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tickFormatter={fmtDisplay} tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={compactCurrency}
              label={{ value: "AUM", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#6b7280" } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={compactCurrency}
              label={{ value: "Net Flow", angle: 90, position: "insideRight", style: { fontSize: 11, fill: "#6b7280" } }}
            />
            <Tooltip
              formatter={(v, name) => [fullCurrency(v), name]}
              labelFormatter={fmtDisplay}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine yAxisId="right" y={0} stroke="#9ca3af" strokeDasharray="2 2" />
            {selectedFirms.map((firm, i) => {
              const color = FIRM_COLORS[i % FIRM_COLORS.length];
              return (
                <Line
                  key={`${firm.id}-aum`}
                  yAxisId="left"
                  type="monotone"
                  dataKey={`${firm.id}_aum`}
                  name={`${firm.name} — AUM`}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  connectNulls
                />
              );
            })}
            {selectedFirms.map((firm, i) => {
              const color = FIRM_COLORS[i % FIRM_COLORS.length];
              return (
                <Line
                  key={`${firm.id}-flow`}
                  yAxisId="right"
                  type="monotone"
                  dataKey={`${firm.id}_flow`}
                  name={`${firm.name} — Net Flow`}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}