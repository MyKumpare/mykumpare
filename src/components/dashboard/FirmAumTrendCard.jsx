import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
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
import { TrendingUp } from "lucide-react";
import FirmMultiSelector from "@/components/firms/FirmMultiSelector";
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

    const data = Array.from(dateMap.values()).sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    );
    return { chartData: data, hasData: data.length > 0 };
  }, [selectedFirms]);

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Firm AUM &amp; Net Flow Trends</h3>
      </div>

      <FirmMultiSelector
        firms={firms}
        selectedIds={selectedIds}
        onChange={(ids) => setSelectedIds(ids.slice(0, MAX_FIRMS))}
      />

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