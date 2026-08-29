import React, { useMemo, useState } from "react";
import { Search, X, ChevronRight, CheckCircle2, Clock, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO } from "date-fns";

/**
 * Process Progress Summary — shows a progress bar for each active due diligence
 * process, indicating the current stage and overall completion percentage.
 *
 * Props:
 *   records — array of DueDiligence records (already filtered for active)
 */
export default function DdProcessProgressSummary({ records = [] }) {
  const [search, setSearch] = useState("");

  const processData = useMemo(() => {
    return records
      .filter((r) => !r.deleted_at && Array.isArray(r.stages) && r.stages.length > 0)
      .map((rec) => {
        const stages = rec.stages || [];
        const totalStages = stages.length;
        const completedStages = stages.filter(
          (s) => s.completed || s.supervisor_status === "approved"
        ).length;
        const currentIdx = rec.current_stage_index || 0;
        const currentStage = stages[currentIdx];

        // Sub-stage progress within current stage
        const subs = currentStage?.sub_stages || [];
        const subsCompleted = subs.filter(
          (ss) => (ss.status || "not_started") === "completed"
        ).length;
        const subPct = subs.length > 0 ? Math.round((subsCompleted / subs.length) * 100) : 0;

        const overallPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

        // Days since start
        let daysActive = 0;
        if (rec.start_date) {
          try {
            daysActive = Math.max(0, differenceInDays(new Date(), parseISO(rec.start_date)));
          } catch { /* ignore */ }
        }

        return {
          id: rec.id,
          firmName: rec.firm_name || "Unknown",
          productName: rec.product_name || "—",
          templateName: rec.template_name || "—",
          status: rec.status || "Pipeline",
          totalStages,
          completedStages,
          currentIdx,
          currentStageName: currentStage?.name || "—",
          currentStageCompleted: !!currentStage?.completed,
          subPct,
          subsCompleted,
          subsTotal: subs.length,
          overallPct,
          daysActive,
          startDate: rec.start_date,
          primaryAnalystName: rec.primary_analyst_name || "—",
        };
      })
      .filter((p) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (
          p.firmName.toLowerCase().includes(q) ||
          p.productName.toLowerCase().includes(q) ||
          p.templateName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.overallPct - a.overallPct);
  }, [records, search]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-800">Active Process Progress</h3>
          <span className="text-xs text-gray-400">({processData.length})</span>
        </div>
        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search processes..."
            className="h-7 pl-7 pr-7 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Process list */}
      {processData.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-6 text-center">
          {search ? "No processes match your search." : "No active due diligence processes."}
        </p>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {processData.map((p) => {
            const isComplete = p.completedStages === p.totalStages;
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-md border p-3 transition-colors",
                  isComplete
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-gray-200 bg-gray-50/30 hover:bg-gray-50"
                )}
              >
                {/* Top row: firm/product + overall % */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {p.firmName}
                      </span>
                      {isComplete && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {p.productName} · {p.templateName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-lg font-bold",
                      isComplete ? "text-emerald-600" : "text-indigo-600"
                    )}>
                      {p.overallPct}%
                    </span>
                    <p className="text-[10px] text-gray-400">
                      {p.completedStages}/{p.totalStages} stages
                    </p>
                  </div>
                </div>

                {/* Overall progress bar */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isComplete ? "bg-emerald-500" : "bg-indigo-500"
                    )}
                    style={{ width: `${p.overallPct}%` }}
                  />
                </div>

                {/* Bottom row: current stage + sub-stage progress + days */}
                <div className="flex items-center justify-between gap-2 mt-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isComplete ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> All stages completed
                      </span>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="text-gray-600 truncate">
                          Stage {p.currentIdx + 1}: {p.currentStageName}
                        </span>
                        {p.subsTotal > 0 && (
                          <span className="text-gray-400 shrink-0">
                            · {p.subsCompleted}/{p.subsTotal} sub-stages
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-gray-400">
                    {/* Sub-stage mini bar */}
                    {!isComplete && p.subsTotal > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 rounded-full"
                            style={{ width: `${p.subPct}%` }}
                          />
                        </div>
                        <span className="text-[10px]">{p.subPct}%</span>
                      </div>
                    )}
                    <span>{p.daysActive}d active</span>
                  </div>
                </div>

                {/* Stage indicators */}
                <div className="flex items-center gap-1 mt-2">
                  {Array.from({ length: p.totalStages }, (_, i) => {
                    const stage = records.find((r) => r.id === p.id)?.stages?.[i];
                    const done = stage?.completed || stage?.supervisor_status === "approved";
                    const isCurrent = i === p.currentIdx && !done;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          done ? "bg-emerald-400" : isCurrent ? "bg-indigo-400" : "bg-gray-200"
                        )}
                        title={`Stage ${i + 1}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}