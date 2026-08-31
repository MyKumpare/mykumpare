import React, { useMemo } from "react";
import { CheckCircle2, Circle, Clock, Lock, Flag, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO } from "date-fns";

/**
 * FirmDdProgressTracker — a visual stage-stepper progress tracker for a single
 * DueDiligence record. Renders a horizontal stage pipeline with completed /
 * current / upcoming states, an overall progress bar, sub-stage progress for
 * the active stage, and key meta (analyst, days active, milestones).
 *
 * Designed to sit at the top of each record card on the firm profile's
 * Due Diligence tab so the status of each process is visible at a glance.
 */
export default function FirmDdProgressTracker({ rec, onOpen }) {
  const data = useMemo(() => {
    const stages = rec?.stages || [];
    if (stages.length === 0) return null;

    const total = stages.length;
    const completed = stages.filter(
      (s) => s.completed || s.supervisor_status === "approved"
    ).length;
    const currentIdx =
      rec.current_stage_index != null ? rec.current_stage_index : 0;

    // find first non-completed stage as the "current" one
    let activeIdx = stages.findIndex(
      (s) => !(s.completed || s.supervisor_status === "approved")
    );
    if (activeIdx === -1) activeIdx = total - 1;

    const activeStage = stages[activeIdx];
    const subs = activeStage?.sub_stages || [];
    const subsDone = subs.filter((s) => (s.status || "not_started") === "completed").length;
    const subsInProcess = subs.filter((s) => s.status === "in_process").length;
    const subPct = subs.length > 0 ? Math.round((subsDone / subs.length) * 100) : 0;

    const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isComplete = completed === total;

    let daysActive = 0;
    if (rec.start_date) {
      try {
        daysActive = Math.max(0, differenceInDays(new Date(), parseISO(rec.start_date)));
      } catch { /* ignore */ }
    }

    const milestones = rec.milestones || [];
    const milestonesDone = milestones.filter((m) => m.completed).length;

    return {
      stages,
      total,
      completed,
      activeIdx,
      activeStageName: activeStage?.name || "—",
      subs,
      subsDone,
      subsInProcess,
      subPct,
      overallPct,
      isComplete,
      daysActive,
      milestones,
      milestonesDone,
    };
  }, [rec]);

  if (!data) return null;

  const { stages, total, completed, activeIdx, isComplete } = data;

  return (
    <div className="mt-2 space-y-2">
      {/* Stage stepper */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {stages.map((stage, i) => {
          const done = stage.completed || stage.supervisor_status === "approved";
          const isCurrent = i === activeIdx && !done;
          const isRejected = stage.supervisor_status === "rejected";
          const isOnHold = stage.supervisor_status === "on_hold";
          const isUpcoming = !done && !isCurrent;

          return (
            <div key={stage.id || i} className="flex items-center flex-shrink-0">
              {/* Node */}
              <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors",
                    done && "bg-emerald-500 border-emerald-500 text-white",
                    isCurrent && !isRejected && !isOnHold && "bg-indigo-500 border-indigo-500 text-white animate-pulse",
                    isRejected && "bg-red-500 border-red-500 text-white",
                    isOnHold && "bg-amber-400 border-amber-400 text-white",
                    isUpcoming && !isRejected && !isOnHold && "bg-white border-gray-300 text-gray-300"
                  )}
                  title={stage.name}
                >
                  {done ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : isRejected ? (
                    "!"
                  ) : isOnHold ? (
                    <Clock className="w-2.5 h-2.5" />
                  ) : isCurrent ? (
                    <span className="text-[9px]">{i + 1}</span>
                  ) : (
                    <span className="text-[9px] text-gray-300">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] font-medium leading-tight text-center max-w-[60px] truncate",
                    done ? "text-emerald-600" : isCurrent ? "text-indigo-600" : "text-gray-400"
                  )}
                >
                  {stage.name}
                </span>
              </div>
              {/* Connector */}
              {i < total - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-4 sm:w-6 rounded-full flex-shrink-0",
                    done ? "bg-emerald-400" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isComplete ? "bg-emerald-500" : "bg-indigo-500"
            )}
            style={{ width: `${data.overallPct}%` }}
          />
        </div>
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            isComplete ? "text-emerald-600" : "text-indigo-600"
          )}
        >
          {data.overallPct}%
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5 min-w-0">
          {isComplete ? (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3" /> All stages complete
            </span>
          ) : (
            <span className="flex items-center gap-1 truncate">
              <ChevronRight className="w-3 h-3 text-indigo-500 shrink-0" />
              <span className="text-gray-700 font-medium truncate">
                {data.activeStageName}
              </span>
              {data.subs.length > 0 && (
                <span className="text-gray-400 shrink-0">
                  · {data.subsDone}/{data.subs.length} sub-steps
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data.milestones.length > 0 && (
            <span className="flex items-center gap-0.5 text-indigo-500" title="Milestones completed">
              <Flag className="w-3 h-3" />
              {data.milestonesDone}/{data.milestones.length}
            </span>
          )}
          <span className="text-gray-400">{data.daysActive}d active</span>
        </div>
      </div>
    </div>
  );
}