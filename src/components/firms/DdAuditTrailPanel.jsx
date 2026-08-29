import React, { useMemo, useState } from "react";
import {
  History, CheckCircle2, XCircle, Clock, PenLine, Play,
  ChevronRight, ShieldAlert, ShieldCheck, ShieldX, FileCheck2, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const ACTION_META = {
  process_created: { label: "Process Created", icon: Play, color: "text-blue-600", bg: "bg-blue-50" },
  stage_started: { label: "Stage Started", icon: Play, color: "text-indigo-600", bg: "bg-indigo-50" },
  sub_stage_started: { label: "Sub-stage Started", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  sub_stage_completed: { label: "Sub-stage Completed", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  stage_approved: { label: "Stage Approved", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
  stage_rejected: { label: "Stage Rejected", icon: ShieldX, color: "text-red-600", bg: "bg-red-50" },
  stage_on_hold: { label: "Stage On Hold", icon: ShieldAlert, color: "text-orange-600", bg: "bg-orange-50" },
  stage_advanced: { label: "Stage Advanced", icon: ChevronRight, color: "text-indigo-600", bg: "bg-indigo-50" },
  signature_collected: { label: "Signature Collected", icon: PenLine, color: "text-rose-600", bg: "bg-rose-50" },
  signature_revoked: { label: "Signature Revoked", icon: XCircle, color: "text-gray-500", bg: "bg-gray-50" },
  bulk_approved: { label: "Bulk Approved", icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
};

/**
 * Compact audit trail panel — shows a chronological history of workflow
 * progression events for a due diligence record.
 *
 * Props:
 *   auditTrail — array of audit entries
 *   compact   — if true, shows only the last 5 entries with a "View all" button
 */
export default function DdAuditTrailPanel({ auditTrail = [], compact = true }) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    return [...(auditTrail || [])].sort((a, b) =>
      (b.timestamp || "").localeCompare(a.timestamp || "")
    );
  }, [auditTrail]);

  const display = compact && !showAll ? sorted.slice(0, 5) : sorted;

  if (!auditTrail || auditTrail.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50/30 p-3">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">Audit Trail</span>
        </div>
        <p className="text-[11px] text-gray-400 italic">No workflow events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">Audit Trail</span>
          <span className="text-[10px] text-gray-400">({auditTrail.length} event{auditTrail.length !== 1 ? "s" : ""})</span>
        </div>
        {compact && sorted.length > 5 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-indigo-600 hover:text-indigo-700"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show less" : `View all (${sorted.length})`}
          </Button>
        )}
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {display.map((entry, i) => {
          const meta = ACTION_META[entry.action_type] || { label: entry.action_type, icon: FileCheck2, color: "text-gray-500", bg: "bg-gray-50" };
          const Icon = meta.icon;
          const isLast = i === display.length - 1;

          return (
            <div key={entry.id} className="flex gap-2">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center shrink-0">
                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", meta.bg)}>
                  <Icon className={cn("w-3 h-3", meta.color)} />
                </div>
                {!isLast && <div className="w-px flex-1 bg-gray-200 mt-0.5" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-gray-700 truncate">
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {entry.timestamp ? format(new Date(entry.timestamp), "MMM d, yyyy 'at' h:mm a") : ""}
                  </span>
                </div>
                {entry.stage_name && (
                  <p className="text-[10px] text-gray-500 truncate">
                    Stage: {entry.stage_name}
                    {entry.sub_stage_name ? ` › ${entry.sub_stage_name}` : ""}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-0.5">
                  {entry.actor_name && (
                    <span className="text-[10px] text-gray-500 truncate">
                      by {entry.actor_name}
                    </span>
                  )}
                  {entry.details && (
                    <span className="text-[10px] text-gray-400 truncate italic">
                      — {entry.details}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}