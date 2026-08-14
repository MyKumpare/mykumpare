import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  ComposedChart,
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
import { Activity } from "lucide-react";

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

function fullCurrency(v) {
  const n = Number(v) || 0;
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Dedicated trends chart visualizing the three flow series over time:
 * Assets Gained (green bars), Assets Loss (red bars, negative), and
 * Net Flow (line). Focused purely on flows — AUM level is shown in the
 * separate AumGrowthChart.
 *
 * @param {Array} rows        - AUM history rows (month_end_date, assets_gained, assets_loss, net_asset_flows)
 * @param {String} entityLabel - "Firm" or "Product"
 * @param {String} name       - Firm/Product name for the header
 */
export default function AumTrendsChart({ rows = [], entityLabel = "Firm", name = "" }) {
  const data = useMemo(
    () =>
      [...rows]
        .filter((r) => r.month_end_date)
        .sort((a, b) => (a.month_end_date || "").localeCompare(b.month_end_date || ""))
        .map((r) => {
          const gained = toNumber(r.assets_gained);
          const loss = toNumber(r.assets_loss);
          return {
            date: fmtDisplay(r.month_end_date),
            "Assets Gained": gained,
            "Assets Loss": loss,
            "Net Flow": gained + loss,
          };
        }),
    [rows]
  );

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-semibold text-gray-800">
          {entityLabel} AUM Flows {name ? `— ${name}` : ""}
        </h4>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
          <Tooltip
            formatter={(v) => fullCurrency(v)}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="2 2" />
          <Bar dataKey="Assets Gained" fill="#16a34a" barSize={16} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Assets Loss" fill="#dc2626" barSize={16} radius={[0, 0, 3, 3]} />
          <Line
            type="monotone"
            dataKey="Net Flow"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}