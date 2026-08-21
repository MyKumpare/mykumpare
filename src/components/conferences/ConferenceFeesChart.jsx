import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DollarSign } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";

/**
 * Extracts a numeric dollar amount from the free-text `fees` field.
 * Handles "$1,200", "1200", "$1,200 per person" etc. Returns null when
 * no parseable number is found (e.g. "Free", "See website").
 */
function parseFee(fees) {
  if (fees == null) return null;
  const s = String(fees).trim();
  if (!s) return null;
  // Match the first number, allowing commas and a leading $.
  const m = s.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

export default function ConferenceFeesChart({ conferences }) {
  const data = useMemo(() => {
    if (!conferences || conferences.length === 0) return [];
    const withFees = conferences
      .filter(c => c.conference_date && parseFee(c.fees) != null)
      .map(c => ({ date: parseISO(c.conference_date), amount: parseFee(c.fees) }));
    if (withFees.length === 0) return [];

    const dates = withFees.map(d => d.date);
    const min = startOfMonth(new Date(Math.min(...dates)));
    const max = endOfMonth(new Date(Math.max(...dates)));
    const months = eachMonthOfInterval({ start: min, end: max });

    return months.map(month => {
      const key = format(month, "yyyy-MM");
      const total = withFees
        .filter(d => format(d.date, "yyyy-MM") === key)
        .reduce((sum, d) => sum + d.amount, 0);
      return { month: format(month, "MMM yy"), total };
    });
  }, [conferences]);

  const grandTotal = useMemo(() => data.reduce((s, d) => s + d.total, 0), [data]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-500" />
          Travel Fees by Month
        </h3>
        <span className="text-xs text-gray-500">
          Total: <span className="font-semibold text-gray-700">{grandTotal.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
        </span>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-8 text-center">
          No conference fees recorded yet. Add fee amounts to your conferences to track the budget here.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
            />
            <Tooltip
              formatter={(v) => [Number(v).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }), "Fees"]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}