import React, { useMemo } from "react";
import { format, parseISO, differenceInDays, isValid } from "date-fns";
import {
  Play, CheckCircle2, Circle, Clock, Flag, Calendar,
  ArrowRight, Milestone, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DdTimelineView — visual timeline for a due diligence process.
 * Maps start dates, milestone targets, and actual completion dates for every stage.
 *
 * Props:
 *   record — a DueDiligence entity record
 */
export default function DdTimelineView({ record }) {
  const data = useMemo(() => buildTimelineData(record), [record]);

  if (!record) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        <AlertCircle className="w-5 h-5 mr-2" />
        No due diligence record selected.
      </div>
    );
  }

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-800">Process Timeline</h3>
        </div>
        <p className="text-xs text-gray-500">
          {record.firm_name} · {record.product_name} · {record.template_name}
        </p>
      </div>

      {/* Summary bar */}
      <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Play className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-gray-500">Started:</span>
          <span className="font-medium text-gray-800">
            {record.start_date ? format(parseISO(record.start_date), "MMM d, yyyy") : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-gray-500">Stages:</span>
          <span className="font-medium text-gray-800">
            {data.completedStages}/{data.totalStages} completed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-gray-500">Milestones:</span>
          <span className="font-medium text-gray-800">
            {data.completedMilestones}/{data.totalMilestones} achieved
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-500">Duration:</span>
          <span className="font-medium text-gray-800">{data.daysActive} days active</span>
        </div>
      </div>

      {/* Stage timeline rows */}
      <div className="px-5 py-4 space-y-1">
        {data.stageRows.map((row, idx) => (
          <StageRow key={row.id} row={row} idx={idx} todayStr={todayStr} />
        ))}
      </div>

      {/* Milestones section */}
      {data.milestoneRows.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Milestone className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Milestones</h4>
          </div>
          <div className="space-y-2">
            {data.milestoneRows.map((m) => (
              <MilestoneRow key={m.id} milestone={m} todayStr={todayStr} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stage Row ──
function StageRow({ row, idx, todayStr }) {
  const isCompleted = row.completed;
  const isCurrent = row.isCurrent;
  const hasDates = row.startDate || row.endDate;

  return (
    <div className="flex items-start gap-3 py-2 group">
      {/* Stage number circle */}
      <div className="flex-shrink-0 mt-0.5">
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : isCurrent ? (
          <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{idx + 1}</span>
          </div>
        ) : (
          <Circle className="w-5 h-5 text-gray-300" />
        )}
      </div>

      {/* Stage content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-sm font-medium",
            isCompleted ? "text-gray-600" : isCurrent ? "text-indigo-700" : "text-gray-400"
          )}>
            {row.name}
          </span>
          {row.supervisorStatus === "approved" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              Approved
            </span>
          )}
          {row.supervisorStatus === "rejected" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              Rejected
            </span>
          )}
          {row.supervisorStatus === "on_hold" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              On Hold
            </span>
          )}
        </div>

        {/* Date line */}
        {hasDates ? (
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-gray-500">
            {row.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseISO(row.startDate), "MMM d, yyyy")}
              </span>
            )}
            {row.endDate && (
              <>
                <ArrowRight className="w-3 h-3 text-gray-300" />
                <span className={cn(
                  "flex items-center gap-1",
                  isCompleted ? "text-emerald-600 font-medium" : ""
                )}>
                  <CheckCircle2 className="w-3 h-3" />
                  {format(parseISO(row.endDate), "MMM d, yyyy")}
                </span>
              </>
            )}
            {row.daysInStage != null && (
              <span className="text-gray-400">({row.daysInStage} days)</span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-300 italic mt-1">Not started</p>
        )}

        {/* Sub-stage mini timeline */}
        {row.subStages.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {row.subStages.map((ss) => (
              <span
                key={ss.id}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full border",
                  ss.status === "completed"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : ss.status === "in_process"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                )}
                title={ss.endDate ? `Completed: ${format(parseISO(ss.endDate), "MMM d")}` : ""}
              >
                {ss.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Milestone Row ──
function MilestoneRow({ milestone, todayStr }) {
  const isCompleted = milestone.completed;
  const isOverdue = !isCompleted && milestone.targetDate && milestone.targetDate < todayStr;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-shrink-0">
        {isCompleted ? (
          <Flag className="w-4 h-4 text-emerald-500" />
        ) : isOverdue ? (
          <Flag className="w-4 h-4 text-red-500" />
        ) : (
          <Flag className="w-4 h-4 text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-xs font-medium",
            isCompleted ? "text-gray-600" : isOverdue ? "text-red-600" : "text-gray-700"
          )}>
            {milestone.name}
          </span>
          <div className="flex items-center gap-2 text-[10px]">
            {milestone.targetDate && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full",
                isCompleted ? "bg-emerald-50 text-emerald-600" : isOverdue ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
              )}>
                Target: {format(parseISO(milestone.targetDate), "MMM d, yyyy")}
              </span>
            )}
            {milestone.completedDate && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                Done: {format(parseISO(milestone.completedDate), "MMM d, yyyy")}
              </span>
            )}
            {isOverdue && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                Overdue
              </span>
            )}
          </div>
        </div>
        {milestone.description && (
          <p className="text-[10px] text-gray-400 mt-0.5">{milestone.description}</p>
        )}
      </div>
    </div>
  );
}

// ── Data builder ──
function buildTimelineData(record) {
  const stages = record?.stages || [];
  const milestones = record?.milestones || [];
  const currentIdx = record?.current_stage_index || 0;
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const stageRows = stages.map((stage, idx) => {
    const completed = stage.completed || stage.supervisor_status === "approved";
    const isCurrent = idx === currentIdx && !completed;
    let daysInStage = null;
    if (stage.start_date) {
      const end = stage.end_date ? parseISO(stage.end_date) : today;
      daysInStage = Math.max(0, differenceInDays(end, parseISO(stage.start_date)));
    }
    return {
      id: stage.id || `stage-${idx}`,
      name: stage.name || `Stage ${idx + 1}`,
      startDate: stage.start_date || null,
      endDate: stage.end_date || null,
      completed,
      isCurrent,
      supervisorStatus: stage.supervisor_status || "pending",
      daysInStage,
      subStages: (stage.sub_stages || []).map((ss) => ({
        id: ss.id || `ss-${Math.random()}`,
        name: ss.name || "Sub-stage",
        status: ss.status || "not_started",
        endDate: ss.end_date || null,
      })),
    };
  });

  const milestoneRows = milestones.map((m) => ({
    id: m.id || `m-${Math.random()}`,
    name: m.name || "Milestone",
    description: m.description || "",
    targetDate: m.target_date || null,
    completedDate: m.completed_date || null,
    completed: !!m.completed,
  }));

  const completedStages = stageRows.filter((s) => s.completed).length;
  const completedMilestones = milestoneRows.filter((m) => m.completed).length;
  const daysActive = record?.start_date
    ? Math.max(0, differenceInDays(today, parseISO(record.start_date)))
    : 0;

  return {
    stageRows,
    milestoneRows,
    totalStages: stageRows.length,
    completedStages,
    totalMilestones: milestoneRows.length,
    completedMilestones,
    daysActive,
    todayStr,
  };
}