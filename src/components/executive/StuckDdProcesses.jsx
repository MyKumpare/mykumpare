import React, { useMemo } from "react";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Stuck DD Processes — highlights due diligence processes that have been
 * stuck in the same stage for more than 5 days.
 *
 * Props:
 *   ddRecords — array of DueDiligence records
 */
export default function StuckDdProcesses({ ddRecords = [] }) {
  const stuckProcesses = useMemo(() => {
    const threshold = 5;
    return ddRecords
      .filter((r) => !r.deleted_at && Array.isArray(r.stages) && r.stages.length > 0)
      .map((rec) => {
        const stages = rec.stages || [];
        const currentIdx = rec.current_stage_index || 0;
        const currentStage = stages[currentIdx];
        if (!currentStage || currentStage.completed) return null;

        // Determine how long the process has been in the current stage
        const stageStart = currentStage.start_date;
        let daysInStage = 0;
        if (stageStart) {
          try {
            daysInStage = differenceInDays(new Date(), parseISO(stageStart));
          } catch { /* ignore */ }
        } else if (rec.start_date) {
          // Fall back to the DD start date if stage start_date isn't set
          try {
            daysInStage = differenceInDays(new Date(), parseISO(rec.start_date));
          } catch { /* ignore */ }
        }

        if (daysInStage <= threshold) return null;

        // Sub-stage progress
        const subs = currentStage.sub_stages || [];
        const subsDone = subs.filter((ss) => (ss.status || "not_started") === "completed").length;
        const subsTotal = subs.length;

        return {
          id: rec.id,
          firmName: rec.firm_name || "Unknown",
          productName: rec.product_name || "—",
          templateName: rec.template_name || "—",
          currentStageName: currentStage.name || "—",
          currentIdx,
          totalStages: stages.length,
          daysInStage,
          subsDone,
          subsTotal,
          primaryAnalystName: rec.primary_analyst_name || "—",
          status: rec.status || "Pipeline",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.daysInStage - a.daysInStage);
  }, [ddRecords]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Stuck Due Diligence Processes</h2>
          <p className="text-xs text-gray-400">In the same stage for more than 5 days</p>
        </div>
        <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2.5 py-0.5">
          {stuckProcesses.length}
        </span>
      </div>

      {/* Body */}
      {stuckProcesses.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400 font-medium">No stuck processes</p>
          <p className="text-xs text-gray-400 mt-1">All active due diligence processes are progressing on schedule.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
          {stuckProcesses.map((p) => {
            const severity = p.daysInStage > 14 ? "high" : p.daysInStage > 9 ? "medium" : "low";
            return (
              <div key={p.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.firmName}</p>
                    <p className="text-xs text-gray-500 truncate">{p.productName} · {p.templateName}</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 shrink-0",
                    severity === "high" ? "bg-red-100 text-red-700" :
                    severity === "medium" ? "bg-orange-100 text-orange-700" :
                    "bg-amber-100 text-amber-700"
                  )}>
                    <Clock className="w-3 h-3" />
                    {p.daysInStage}d
                  </div>
                </div>
                {/* Stage info */}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                  <span className="font-medium text-gray-600">
                    Stage {p.currentIdx + 1}/{p.totalStages}:
                  </span>
                  <span className="truncate">{p.currentStageName}</span>
                  {p.subsTotal > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{p.subsDone}/{p.subsTotal} sub-stages</span>
                    </>
                  )}
                </div>
                {/* Analyst */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-gray-400">{p.primaryAnalystName}</span>
                  <span className="text-[11px] text-indigo-500 font-medium flex items-center gap-0.5">
                    View <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}