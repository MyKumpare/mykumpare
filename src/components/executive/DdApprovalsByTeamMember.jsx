import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import { ClipboardCheck } from "lucide-react";
import { ChartCard, EmptyChart, TYPE_COLORS } from "./execDashboardModules";

const PERIOD_OPTIONS = [
  { key: "quarter", label: "Last Quarter", months: 3 },
  { key: "6months", label: "Last 6 Months", months: 6 },
  { key: "12months", label: "Last 12 Months", months: 12 },
];

const APPROVAL_ACTION_TYPES = ["stage_approved", "bulk_approved"];

/**
 * DD Approvals by Team Member — horizontal bar chart showing how many due
 * diligence stage approvals each team member has completed, with a selectable
 * time period (last quarter, last 6 months, last 12 months).
 *
 * Counts audit_trail entries with action_type "stage_approved" or
 * "bulk_approved" within the selected period, grouped by actor_name.
 *
 * Props:
 *   ddRecords — array of DueDiligence records (each has an audit_trail array)
 */
export default function DdApprovalsByTeamMember({ ddRecords = [] }) {
  const [periodKey, setPeriodKey] = useState("quarter");

  const data = useMemo(() => {
    const option = PERIOD_OPTIONS.find((p) => p.key === periodKey);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - option.months);
    const cutoffMs = cutoff.getTime();

    const map = {};
    for (const r of ddRecords) {
      if (r.deleted_at) continue;
      const trail = r.audit_trail || [];
      for (const entry of trail) {
        if (!APPROVAL_ACTION_TYPES.includes(entry.action_type)) continue;
        if (!entry.actor_name) continue;
        const ts = new Date(entry.timestamp).getTime();
        if (isNaN(ts) || ts < cutoffMs) continue;
        map[entry.actor_name] = (map[entry.actor_name] || 0) + 1;
      }
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [ddRecords, periodKey]);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const activeOption = PERIOD_OPTIONS.find((p) => p.key === periodKey);

  return (
    <ChartCard
      title="DD Approvals by Team Member"
      subtitle={`${total} approval${total !== 1 ? "s" : ""} · ${activeOption.label.toLowerCase()}`}
      icon={ClipboardCheck}
      iconColor="text-emerald-600"
    >
      <div className="flex items-center gap-1 mb-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriodKey(opt.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                periodKey === opt.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <EmptyChart label="No approvals in this period" />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip
              cursor={{ fill: "#f9fafb" }}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24} name="Approvals">
              {data.map((_, idx) => (
                <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}