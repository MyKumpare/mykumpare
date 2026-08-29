import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import { ClipboardCheck } from "lucide-react";
import { ChartCard, EmptyChart, TYPE_COLORS } from "./execDashboardModules";

const STATUS_COLORS = {
  "Pipeline": "#6366f1",
  "On Hold": "#f59e0b",
  "Buy List": "#10b981",
  "Watch List": "#06b6d4",
  "Rejected": "#ef4444",
  "In-Process": "#8b5cf6",
};

/**
 * DD Processes by Status — bar chart showing the count of active due diligence
 * processes grouped by their current status.
 *
 * Props:
 *   ddRecords — array of DueDiligence records
 */
export default function DdProcessesByStatus({ ddRecords = [] }) {
  const data = useMemo(() => {
    const active = ddRecords.filter((r) => !r.deleted_at);
    const map = {};
    for (const r of active) {
      const status = r.status || "Pipeline";
      map[status] = (map[status] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [ddRecords]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartCard
      title="Due Diligence Processes by Status"
      subtitle={`${total} active process${total !== 1 ? "es" : ""}`}
      icon={ClipboardCheck}
      iconColor="text-indigo-600"
    >
      {data.length === 0 ? (
        <EmptyChart label="No due diligence processes" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              angle={-15}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f9fafb" }}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={STATUS_COLORS[entry.name] || TYPE_COLORS[idx % TYPE_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}