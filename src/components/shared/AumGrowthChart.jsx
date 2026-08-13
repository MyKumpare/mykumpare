import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  ComposedChart,
  Area,
  Bar,
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

function fmtDisplay(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  return isNaN(d.getTime()) ? iso : format(d, "MM/dd/yyyy");
}

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

/**
 * Dedicated chart tracking AUM growth and Net Flow over time.
 * Uses the historical AUM rows already entered for the firm/product.
 *
 * @param {Array} rows        - AUM history rows (month_end_date, firm_aum, net_asset_flows)
 * @param {String} entityLabel - "Firm" or "Product"
 * @param {String} name       - Firm/Product name for the header
 */
export default function AumGrowthChart({ rows = [], entityLabel = "Firm", name = "" }) {
  const data = useMemo(
    () =>
      [...rows]
        .filter((r) => r.month_end_date)
        .sort((a, b) => (a.month_end_date || "").localeCompare(b.month_end_date || ""))
        .map((r) => ({
          date: fmtDisplay(r.month_end_date),
          aum: toNumber(r.firm_aum),
          netFlow: toNumber(r.net_asset_flows),
        })),
    [rows]
  );

  if (data.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl bg-white">
        No AUM data yet. Add monthly entries to see AUM growth and Net Flow over time.
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-semibold text-gray-800">
          {entityLabel} AUM Growth &amp; Net Flow {name ? `— ${name}` : ""}
        </h4>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="aumGrowthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            tickFormatter={compactCurrency}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={compactCurrency}
          />
          <Tooltip
            formatter={(v, name) => {
              const n = Number(v);
              const formatted = (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
              return [formatted, name];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine yAxisId="right" y={0} stroke="#9ca3af" strokeDasharray="2 2" />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="aum"
            name={`${entityLabel} AUM`}
            stroke="#4f46e5"
            strokeWidth={2.5}
            fill="url(#aumGrowthFill)"
            dot={{ r: 3 }}
          />
          <Bar
            yAxisId="right"
            dataKey="netFlow"
            name="Net Flow"
            fill="#f59e0b"
            barSize={18}
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="netFlow"
            name="Net Flow"
            stroke="#d97706"
            strokeWidth={2}
            dot={{ r: 2 }}
            strokeDasharray="4 2"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}