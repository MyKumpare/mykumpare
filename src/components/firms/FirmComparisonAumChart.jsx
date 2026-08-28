import React, { useMemo } from "react";
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
} from "recharts";
import { TrendingUp } from "lucide-react";
import { FIRM_COLORS } from "./FirmMetricsTable";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function compactCurrency(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

/**
 * Combined AUM trend chart overlaying all selected firms on a single axis.
 * Each firm gets a differently colored line.
 */
export default function FirmComparisonAumChart({ firms = [], dateRange }) {
  const data = useMemo(() => {
    const dateMap = new Map();
    for (const firm of firms) {
      for (const row of firm.aum_history || []) {
        if (!row.month_end_date) continue;
        if (dateRange?.start && row.month_end_date < dateRange.start) continue;
        if (dateRange?.end && row.month_end_date > dateRange.end) continue;
        if (!dateMap.has(row.month_end_date)) {
          dateMap.set(row.month_end_date, { date: row.month_end_date });
        }
        dateMap.get(row.month_end_date)[firm.id] = toNumber(row.firm_aum);
      }
    }
    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [firms, dateRange]);

  if (data.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl bg-white">
        No AUM data for selected firms.
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">
          AUM Trends — Side by Side
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            angle={-25}
            textAnchor="end"
            height={60}
            tickFormatter={(d) => {
              const dt = parseISO(d);
              return isNaN(dt.getTime()) ? d : format(dt, "MM/yy");
            }}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
          <Tooltip
            formatter={(v, name) => {
              const n = Number(v);
              const formatted =
                (n < 0 ? "-$" : "$") +
                Math.abs(n).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                });
              return [formatted, name];
            }}
            labelFormatter={(d) => {
              const dt = parseISO(d);
              return isNaN(dt.getTime()) ? d : format(dt, "MM/dd/yyyy");
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {firms.map((firm, i) => (
            <Line
              key={firm.id}
              type="monotone"
              dataKey={firm.id}
              name={firm.name}
              stroke={FIRM_COLORS[i % FIRM_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}