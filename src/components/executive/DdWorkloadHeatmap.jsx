import React, { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { ChartCard, EmptyChart } from "./execDashboardModules";

/**
 * DD Workload Heatmap — grid of team members (rows) × due diligence status
 * (columns), with cell color intensity proportional to the number of active
 * DD processes assigned to that member at that status. Helps balance workload
 * across the team and spot bottlenecks.
 *
 * A process counts toward both its primary and secondary analyst (if assigned),
 * so a member shared across many processes is visibly hotter.
 *
 * Props:
 *   ddRecords — array of DueDiligence records
 */
const STATUS_ORDER_FALLBACK = [
  "Pipeline",
  "In Review",
  "Deep Dive",
  "Buy List",
  "Rejected",
  "On Hold",
];

// Green-to-red heat scale (low = cool/green, high = hot/red)
const HEAT_STOPS = [
  { threshold: 0, bg: "#f9fafb", text: "#9ca3af" },
  { threshold: 1, bg: "#dcfce7", text: "#166534" },
  { threshold: 3, bg: "#bbf7d0", text: "#15803d" },
  { threshold: 5, bg: "#fde68a", text: "#854d0e" },
  { threshold: 8, bg: "#fdba74", text: "#9a3412" },
  { threshold: 12, bg: "#fca5a5", text: "#991b1b" },
  { threshold: 16, bg: "#ef4444", text: "#ffffff" },
];

function heatStyle(count) {
  if (!count) return { backgroundColor: HEAT_STOPS[0].bg, color: HEAT_STOPS[0].text };
  let stop = HEAT_STOPS[0];
  for (const s of HEAT_STOPS) {
    if (count >= s.threshold) stop = s;
  }
  return { backgroundColor: stop.bg, color: stop.text };
}

export default function DdWorkloadHeatmap({ ddRecords = [] }) {
  const [showSecondary, setShowSecondary] = useState(true);

  const { members, statuses, matrix, totals } = useMemo(() => {
    const memberSet = new Set();
    const statusSet = new Set();

    for (const r of ddRecords) {
      if (r.deleted_at) continue;
      if (r.primary_analyst_name) memberSet.add(r.primary_analyst_name);
      if (showSecondary && r.secondary_analyst_name) memberSet.add(r.secondary_analyst_name);
      if (r.status) statusSet.add(r.status);
    }

    // Order statuses: known ones first (by STATUS_ORDER_FALLBACK), then any extras alphabetically
    const statuses = [
      ...STATUS_ORDER_FALLBACK.filter((s) => statusSet.has(s)),
      ...Array.from(statusSet).filter((s) => !STATUS_ORDER_FALLBACK.includes(s)).sort(),
    ];

    const members = Array.from(memberSet).sort();

    // matrix[member][status] = count
    const matrix = {};
    const totals = {};
    for (const m of members) {
      matrix[m] = {};
      totals[m] = 0;
      for (const s of statuses) matrix[m][s] = 0;
    }

    for (const r of ddRecords) {
      if (r.deleted_at || !r.status) continue;
      const assignees = [];
      if (r.primary_analyst_name) assignees.push(r.primary_analyst_name);
      if (showSecondary && r.secondary_analyst_name) assignees.push(r.secondary_analyst_name);
      for (const a of assignees) {
        if (matrix[a]) {
          matrix[a][r.status] = (matrix[a][r.status] || 0) + 1;
          totals[a] += 1;
        }
      }
    }

    // Sort members by total workload descending
    members.sort((a, b) => totals[b] - totals[a]);

    return { members, statuses, matrix, totals };
  }, [ddRecords, showSecondary]);

  const grandTotal = Object.values(totals).reduce((s, n) => s + n, 0);
  const maxCell = useMemo(() => {
    let m = 0;
    for (const mem of members) for (const st of statuses) m = Math.max(m, matrix[mem]?.[st] || 0);
    return m;
  }, [members, statuses, matrix]);

  return (
    <ChartCard
      title="DD Workload Heatmap"
      subtitle={`${grandTotal} assignment${grandTotal !== 1 ? "s" : ""} across ${members.length} member${members.length !== 1 ? "s" : ""}`}
      icon={Users}
      iconColor="text-indigo-600"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span>Less</span>
          {HEAT_STOPS.map((s) => (
            <span key={s.threshold} className="w-4 h-4 rounded-sm border border-gray-200" style={{ backgroundColor: s.bg }} />
          ))}
          <span>More</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showSecondary}
            onChange={(e) => setShowSecondary(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300"
          />
          Include secondary analysts
        </label>
      </div>

      {members.length === 0 ? (
        <EmptyChart label="No assigned due diligence processes" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white text-left text-xs font-medium text-gray-500 py-2 pr-3 align-bottom whitespace-nowrap">
                  Team Member
                </th>
                {statuses.map((s) => (
                  <th key={s} className="text-center text-xs font-medium text-gray-500 py-2 px-1 align-bottom whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">{s}</span>
                    </div>
                  </th>
                ))}
                <th className="text-center text-xs font-semibold text-gray-700 py-2 px-2 align-bottom whitespace-nowrap">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m}>
                  <td className="sticky left-0 bg-white text-xs font-medium text-gray-800 py-1.5 pr-3 whitespace-nowrap border-b border-gray-50">
                    {m}
                  </td>
                  {statuses.map((s) => {
                    const count = matrix[m]?.[s] || 0;
                    return (
                      <td key={s} className="py-1 px-1 text-center border-b border-gray-50">
                        <div
                          className="w-full min-w-[44px] h-9 rounded-md flex items-center justify-center text-xs font-semibold transition-colors"
                          style={heatStyle(count)}
                          title={`${m} · ${s}: ${count} process${count !== 1 ? "es" : ""}`}
                        >
                          {count || ""}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center py-1.5 px-2 border-b border-gray-50">
                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                      {totals[m]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}