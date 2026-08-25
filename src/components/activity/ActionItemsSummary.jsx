import React, { useMemo } from "react";
import { CheckCircle2, Clock, XCircle, Loader, ListChecks, Flame } from "lucide-react";

const STATUS_META = [
  { key: "Not Started", label: "Pending",     icon: Clock,       accent: "text-gray-600",   bg: "bg-gray-50",   ring: "ring-gray-200",   dot: "bg-gray-400" },
  { key: "In-process", label: "In Progress",  icon: Loader,       accent: "text-blue-600",   bg: "bg-blue-50",   ring: "ring-blue-200",   dot: "bg-blue-500" },
  { key: "Completed",  label: "Completed",    icon: CheckCircle2, accent: "text-green-600",  bg: "bg-green-50",  ring: "ring-green-200",  dot: "bg-green-500" },
  { key: "Cancelled",  label: "Cancelled",    icon: XCircle,      accent: "text-red-500",    bg: "bg-red-50",    ring: "ring-red-200",    dot: "bg-red-400" },
];

export default function ActionItemsSummary({ tasks }) {
  const counts = useMemo(() => {
    const c = { total: 0, highPriorityOpen: 0 };
    STATUS_META.forEach(s => { c[s.key] = 0; });
    (tasks || []).forEach(t => {
      c.total++;
      const key = STATUS_META.find(s => s.key === t.status) ? t.status : "Not Started";
      c[key]++;
      if (t.is_high_priority && t.status !== "Completed" && t.status !== "Cancelled") c.highPriorityOpen++;
    });
    return c;
  }, [tasks]);

  const openTotal = counts["Not Started"] + counts["In-process"];
  const completedPct = counts.total > 0 ? Math.round((counts.Completed / counts.total) * 100) : 0;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-700">Action Items Summary</h2>
        <span className="text-xs text-gray-400">— across all firms</span>
      </div>

      {/* Progress bar: open vs completed */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">
            <span className="font-semibold text-gray-700">{openTotal}</span> open
            <span className="text-gray-300 mx-1">·</span>
            <span className="font-semibold text-green-600">{counts.Completed}</span> completed
          </span>
          <span className="text-xs font-semibold text-gray-600">{completedPct}% complete</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
          <div className="h-full bg-gray-400" style={{ width: `${counts.total > 0 ? (counts["Not Started"] / counts.total) * 100 : 0}%` }} title="Pending" />
          <div className="h-full bg-blue-500" style={{ width: `${counts.total > 0 ? (counts["In-process"] / counts.total) * 100 : 0}%` }} title="In Progress" />
          <div className="h-full bg-green-500" style={{ width: `${counts.total > 0 ? (counts.Completed / counts.total) * 100 : 0}%` }} title="Completed" />
          <div className="h-full bg-red-400" style={{ width: `${counts.total > 0 ? (counts.Cancelled / counts.total) * 100 : 0}%` }} title="Cancelled" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STATUS_META.map(s => {
          const Icon = s.icon;
          const count = counts[s.key] || 0;
          return (
            <div key={s.key} className={`rounded-lg ${s.bg} ring-1 ${s.ring} px-3 py-2.5 flex items-center gap-2.5`}>
              <Icon className={`w-5 h-5 ${s.accent} flex-shrink-0`} />
              <div className="min-w-0">
                <div className="text-lg font-bold text-gray-800 leading-none">{count}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {counts.highPriorityOpen > 0 && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
          <Flame className="w-3.5 h-3.5" />
          {counts.highPriorityOpen} high-priority task{counts.highPriorityOpen !== 1 ? "s" : ""} still open
        </div>
      )}
    </div>
  );
}