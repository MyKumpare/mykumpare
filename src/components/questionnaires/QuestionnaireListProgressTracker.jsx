import React, { useMemo } from "react";
import { Clock, Eye, CheckCircle2, ClipboardList } from "lucide-react";

/**
 * Aggregate progress tracker showing how many questionnaires are in each
 * lifecycle stage across the entire list.
 *
 * Stages:
 *   Pending      → Draft, Sent, In Progress (not yet submitted)
 *   Under Review → Submitted, Under Review
 *   Completed    → Completed
 *
 * Props:
 *   questionnaires — array of questionnaire records
 */
const PENDING_STATUSES = ["Draft", "Sent", "In Progress"];
const REVIEW_STATUSES = ["Submitted", "Under Review"];

export default function QuestionnaireListProgressTracker({ questionnaires = [] }) {
  const stats = useMemo(() => {
    let pending = 0, review = 0, completed = 0;
    questionnaires.forEach((q) => {
      if (q.status === "Completed") completed++;
      else if (REVIEW_STATUSES.includes(q.status)) review++;
      else pending++;
    });
    const total = questionnaires.length;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return { pending, review, completed, total, pct };
  }, [questionnaires]);

  const stages = [
    { key: "pending", label: "Pending", count: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-400", dot: "bg-amber-500" },
    { key: "review", label: "Under Review", count: stats.review, icon: Eye, color: "text-indigo-600", bg: "bg-indigo-50", bar: "bg-indigo-400", dot: "bg-indigo-500" },
    { key: "completed", label: "Completed", count: stats.completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", bar: "bg-emerald-400", dot: "bg-emerald-500" },
  ];

  if (stats.total === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 mb-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <ClipboardList className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700">Progress Overview</span>
        <span className="text-[10px] text-gray-400 ml-auto">{stats.total} total</span>
      </div>

      {/* Stacked progress bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 mb-2.5">
        {stages.map((s) => (
          <div
            key={s.key}
 className={`${s.bar} transition-all`}
            style={{ width: `${stats.pct(s.count)}%` }}
            title={`${s.label}: ${s.count} (${stats.pct(s.count)}%)`}
          />
        ))}
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-3 gap-2">
        {stages.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className={`rounded-md ${s.bg} px-2 py-1.5 flex items-center gap-1.5`}>
              <Icon className={`w-3 h-3 ${s.color} flex-shrink-0`} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-gray-800">{s.count}</span>
                  <span className="text-[9px] text-gray-500">{stats.pct(s.count)}%</span>
                </div>
                <div className="text-[9px] text-gray-500 truncate">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}