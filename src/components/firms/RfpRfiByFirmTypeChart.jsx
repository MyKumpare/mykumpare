import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { FileSearch } from "lucide-react";

const BAR_COLOR = "hsl(var(--primary))";

/**
 * Bar chart showing the count of OPEN RFP/RFI proposals grouped by firm type.
 * Each open proposal is counted under every firm type its firm belongs to.
 */
export default function RfpRfiByFirmTypeChart({ data, height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-400 italic py-10">
        <FileSearch className="w-8 h-8 text-gray-300" />
        <span className="text-sm">No open proposals to chart yet.</span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="firmType"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={70}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            formatter={(v) => [`${v} open`, "Proposals"]}
          />
          <Bar dataKey="count" name="Open Proposals" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.firmType === "Uncategorized" ? "#cbd5e1" : BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}