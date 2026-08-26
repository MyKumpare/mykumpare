import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  CheckCircle2, Clock, XCircle, Loader, ListChecks, Flame, Building2, TrendingUp,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

const STATUS_META = [
  { key: "Not Started", label: "Pending",     icon: Clock,       color: "#9ca3af", bg: "bg-gray-50",   ring: "ring-gray-200",   text: "text-gray-600" },
  { key: "In-process", label: "In Progress",  icon: Loader,       color: "#3b82f6", bg: "bg-blue-50",   ring: "ring-blue-200",   text: "text-blue-600" },
  { key: "Completed",  label: "Completed",    icon: CheckCircle2, color: "#22c55e", bg: "bg-green-50",  ring: "ring-green-200",  text: "text-green-600" },
  { key: "Cancelled",  label: "Cancelled",    icon: XCircle,      color: "#f87171", bg: "bg-red-50",    ring: "ring-red-200",    text: "text-red-500" },
];

const PRIORITY_META = [
  { key: "High",   label: "High",   color: "#ef4444" },
  { key: "Medium", label: "Medium", color: "#f59e0b" },
  { key: "Low",    label: "Low",    color: "#9ca3af" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ActionItemsDashboard() {
  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["action_items_dashboard_tasks"],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date", 2000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["action_items_dashboard_firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 2000),
  });

  const tasks = useMemo(
    () => (allTasks || []).filter(t => !t.deleted_at && t.board_meeting_id),
    [allTasks]
  );

  const counts = useMemo(() => {
    const c = { total: 0, highPriorityOpen: 0, overdue: 0, dueThisWeek: 0 };
    STATUS_META.forEach(s => { c[s.key] = 0; });
    const today = todayStr();
    const weekOut = new Date(); weekOut.setDate(weekOut.getDate() + 7);
    const weekStr = weekOut.toISOString().slice(0, 10);
    tasks.forEach(t => {
      c.total++;
      const key = STATUS_META.find(s => s.key === t.status) ? t.status : "Not Started";
      c[key]++;
      if (t.is_high_priority && t.status !== "Completed" && t.status !== "Cancelled") c.highPriorityOpen++;
      if (t.due_date && t.status !== "Completed" && t.status !== "Cancelled") {
        if (t.due_date < today) c.overdue++;
        if (t.due_date >= today && t.due_date <= weekStr) c.dueThisWeek++;
      }
    });
    return c;
  }, [tasks]);

  const openTotal = counts["Not Started"] + counts["In-process"];
  const completedPct = counts.total > 0 ? Math.round((counts.Completed / counts.total) * 100) : 0;

  // Pie chart data
  const pieData = STATUS_META.map(s => ({ name: s.label, value: counts[s.key] || 0, color: s.color }))
    .filter(d => d.value > 0);

  // Per-firm breakdown (open vs completed)
  const firmBreakdown = useMemo(() => {
    const firmById = {};
    (firms || []).forEach(f => { if (f.id) firmById[f.id] = f.name || "—"; });
    const map = {};
    tasks.forEach(t => {
      const fid = t.originator_firm_id || t.assigned_to_firm_id;
      if (!fid) return;
      if (!map[fid]) map[fid] = { firmId: fid, firmName: firmById[fid] || "—", open: 0, completed: 0, cancelled: 0 };
      if (t.status === "Completed") map[fid].completed++;
      else if (t.status === "Cancelled") map[fid].cancelled++;
      else map[fid].open++;
    });
    return Object.values(map)
      .filter(r => r.open > 0 || r.completed > 0)
      .sort((a, b) => (b.open + b.completed) - (a.open + a.completed))
      .slice(0, 10);
  }, [tasks, firms]);

  // Priority breakdown (open tasks only)
  const priorityBreakdown = useMemo(() => {
    const c = { High: 0, Medium: 0, Low: 0, Unset: 0 };
    tasks.forEach(t => {
      if (t.status === "Completed" || t.status === "Cancelled") return;
      const p = t.priority || (t.is_high_priority ? "High" : "Unset");
      c[p] = (c[p] || 0) + 1;
    });
    return c;
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        <Loader className="w-5 h-5 animate-spin mr-2" /> Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-indigo-600" />
        <h1 className="text-lg font-bold text-gray-800">Action Items Dashboard</h1>
        <span className="text-xs text-gray-400">({counts.total} total action items)</span>
      </div>

      {/* Top row: stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_META.map(s => {
          const Icon = s.icon;
          const count = counts[s.key] || 0;
          return (
            <div key={s.key} className={`rounded-xl ${s.bg} ring-1 ${s.ring} px-4 py-3 flex items-center gap-3`}>
              <Icon className={`w-7 h-7 ${s.text} flex-shrink-0`} />
              <div>
                <div className="text-2xl font-bold text-gray-800 leading-none">{count}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert pills */}
      <div className="flex flex-wrap gap-2">
        {counts.highPriorityOpen > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <Flame className="w-3.5 h-3.5" /> {counts.highPriorityOpen} high-priority open
          </span>
        )}
        {counts.overdue > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <Clock className="w-3.5 h-3.5" /> {counts.overdue} overdue
          </span>
        )}
        {counts.dueThisWeek > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <Clock className="w-3.5 h-3.5" /> {counts.dueThisWeek} due this week
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          <TrendingUp className="w-3.5 h-3.5" /> {completedPct}% complete
        </span>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut: status distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Status Distribution</h3>
          {pieData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  formatter={(value, name) => [`${value} task${value !== 1 ? "s" : ""}`, name]}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: per-firm open vs completed */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-500" /> Top Firms — Open vs Completed
          </h3>
          {firmBreakdown.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={firmBreakdown} layout="vertical" margin={{ left: 10, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  type="category"
                  dataKey="firmName"
                  tick={{ fontSize: 11 }}
                  stroke="#6b7280"
                  width={120}
                  tickFormatter={(v) => v.length > 18 ? v.slice(0, 16) + "…" : v}
                />
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  cursor={{ fill: "#f9fafb" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="open" name="Open" fill="#3b82f6" radius={[0, 3, 3, 0]} stackId="a" />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[0, 3, 3, 0]} stackId="a" />
                <Bar dataKey="cancelled" name="Cancelled" fill="#f87171" radius={[0, 3, 3, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Priority breakdown (open tasks) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Open Tasks by Priority</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRIORITY_META.map(p => {
            const count = priorityBreakdown[p.key] || 0;
            return (
              <div key={p.key} className="rounded-lg border border-gray-200 px-3 py-2.5 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <div>
                  <div className="text-lg font-bold text-gray-800 leading-none">{count}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{p.label}</div>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-gray-200 px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300" />
            <div>
              <div className="text-lg font-bold text-gray-800 leading-none">{priorityBreakdown.Unset || 0}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Unset</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}