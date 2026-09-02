import React from "react";
import { CheckCircle2, Circle, Clock, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

// Builds a progress summary of the scoring matrix evaluation so the user can
// track which scoring phases and audit sections are finished for ongoing tasks.
export default function ScoringAuditStatusSummary({ score, auditData }) {
  const blocks = score?.scoring_blocks || [];
  const allCriteria = blocks.flatMap((b) => (b.criteria || []).map((c) => ({ ...c, block_name: b.name })));
  const total = allCriteria.length;

  const countScored = (field) => allCriteria.filter((c) => c[field] != null && c[field] !== undefined).length;
  const countWithNotes = (field) => allCriteria.filter((c) => c[field] && String(c[field]).trim().length > 0).length;

  const phases = [
    { label: "Primary", scored: countScored("primary_score"), notes: countWithNotes("primary_notes") },
    { label: "Secondary", scored: countScored("secondary_score"), notes: countWithNotes("secondary_notes"), optional: !score?.secondary_scoring_enabled },
    { label: "Team", scored: countScored("team_score"), notes: countWithNotes("team_notes") },
    { label: "IC", scored: countScored("ic_score"), notes: countWithNotes("ic_notes") },
    { label: "Final", scored: countScored("final_score"), notes: countWithNotes("final_notes") },
  ].filter((p) => !p.optional);

  const auditSections = auditData
    ? [
        { label: "Executive Summary", done: !!auditData.executive_summary },
        { label: "Strengths", done: Array.isArray(auditData.strengths) && auditData.strengths.length > 0 },
        { label: "Weaknesses", done: Array.isArray(auditData.weaknesses) && auditData.weaknesses.length > 0 },
        { label: "Areas of Concern", done: Array.isArray(auditData.areas_of_concern) && auditData.areas_of_concern.length > 0 },
        { label: "Follow-Up Items", done: Array.isArray(auditData.follow_up_items) && auditData.follow_up_items.length > 0 },
        { label: "Re-Scoring Recommendations", done: Array.isArray(auditData.rescoring_recommendations) && auditData.rescoring_recommendations.length > 0 },
        { label: "Independent AI Scores", done: Array.isArray(auditData.independent_scores) && auditData.independent_scores.length > 0 },
        { label: "Overall Assessment", done: !!auditData.overall_assessment },
      ]
    : null;

  const overallScored = phases.filter((p) => p.scored === total && total > 0).length;
  const overallPct = total > 0 ? Math.round((phases.reduce((acc, p) => acc + p.scored, 0) / (phases.length * total)) * 100) : 0;

  // Total tasks across all phases (each criterion in each phase is one task)
  const totalTasks = phases.length * total;
  const completedTasks = phases.reduce((acc, p) => acc + p.scored, 0);
  const remainingTasks = Math.max(totalTasks - completedTasks, 0);
  const pieData = [
    { name: "Completed", value: completedTasks, color: "#22c55e" },
    { name: "Remaining", value: remainingTasks, color: "#e2e8f0" },
  ].filter((d) => d.value > 0);

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-semibold flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-slate-500" />
          Scoring Progress Summary
        </h5>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", overallPct === 100 ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600")}>
          {overallPct}% complete
        </span>
      </div>

      {/* Donut chart: completed vs remaining tasks */}
      {totalTasks > 0 && (
        <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-200">
          <div className="relative w-24 h-24 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={44}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-slate-800 leading-none">{overallPct}%</span>
              <span className="text-[10px] text-slate-500 mt-0.5">complete</span>
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                Completed
              </span>
              <span className="font-semibold text-slate-800">{completedTasks}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                Remaining
              </span>
              <span className="font-semibold text-slate-800">{remainingTasks}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
              <span className="font-medium text-slate-600">Total Tasks</span>
              <span className="font-semibold text-slate-800">{totalTasks}</span>
            </div>
          </div>
        </div>
      )}

      {/* Phase completion bars */}
      <div className="space-y-2">
        {phases.map((p) => {
          const pct = total > 0 ? Math.round((p.scored / total) * 100) : 0;
          const isDone = total > 0 && p.scored === total;
          return (
            <div key={p.label}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Circle className="w-3.5 h-3.5 text-slate-300" />}
                  {p.label} Scores
                </span>
                <span className="text-slate-500">
                  {p.scored}/{total} scored · {p.notes}/{total} with notes
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", isDone ? "bg-green-500" : "bg-blue-400")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit section checklist */}
      {auditSections && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <h6 className="text-xs font-semibold text-slate-600 mb-2">Audit Sections Generated</h6>
          <div className="grid grid-cols-2 gap-1.5">
            {auditSections.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 text-xs">
                {s.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                )}
                <span className={s.done ? "text-slate-700" : "text-slate-400"}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-slate-400 italic mt-2">No criteria found in this scoring matrix.</p>
      )}
    </div>
  );
}