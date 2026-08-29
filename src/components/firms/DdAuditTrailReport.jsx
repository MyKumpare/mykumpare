import React, { useMemo } from "react";
import {
  History, Printer, FileCheck2, Play, CheckCircle2, XCircle,
  Clock, PenLine, ChevronRight, ShieldAlert, ShieldCheck, ShieldX, Zap,
  Building2, Package, FileText, CalendarDays, User,
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
 * Audit Trail Report — a clean, printable summary of all workflow events
 * for a due diligence process. Shows process metadata, a chronological event
 * timeline with timestamps and actors, and summary statistics.
 *
 * Props:
 *   open         — dialog open state
 *   onOpenChange — dialog open setter
 *   ddRecord     — the DueDiligence record (must include audit_trail + metadata)
 */
export default function DdAuditTrailReport({ open, onOpenChange, ddRecord }) {
  const sorted = useMemo(() => {
    return [...(ddRecord?.audit_trail || [])].sort((a, b) =>
      (a.timestamp || "").localeCompare(b.timestamp || "")
    );
  }, [ddRecord?.audit_trail]);

  const stats = useMemo(() => {
    const trail = ddRecord?.audit_trail || [];
    return {
      total: trail.length,
      approvals: trail.filter((e) => e.action_type === "stage_approved").length,
      rejections: trail.filter((e) => e.action_type === "stage_rejected").length,
      signatures: trail.filter((e) => e.action_type === "signature_collected").length,
      subStageCompletions: trail.filter((e) => e.action_type === "sub_stage_completed").length,
    };
  }, [ddRecord?.audit_trail]);

  const handlePrint = () => {
    window.print();
  };

  if (!ddRecord) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            Audit Trail Report
          </DialogTitle>
        </DialogHeader>

        {/* Printable report block */}
        <div className="pdf-block space-y-4 p-2">
          {/* Header */}
          <div className="border-b border-gray-200 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Due Diligence Audit Trail Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Generated {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          {/* Process metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500">Firm:</span>
              <span className="font-medium text-gray-900 truncate">{ddRecord.firm_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500">Product:</span>
              <span className="font-medium text-gray-900 truncate">{ddRecord.product_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500">Template:</span>
              <span className="font-medium text-gray-900 truncate">{ddRecord.template_name || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500">Start Date:</span>
              <span className="font-medium text-gray-900">{ddRecord.start_date || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500">Status:</span>
              <span className="font-medium text-gray-900">{ddRecord.status || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500">Primary Analyst:</span>
              <span className="font-medium text-gray-900 truncate">{ddRecord.primary_analyst_name || "—"}</span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Total Events", value: stats.total, color: "text-gray-700", bg: "bg-gray-50" },
              { label: "Approvals", value: stats.approvals, color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Rejections", value: stats.rejections, color: "text-red-700", bg: "bg-red-50" },
              { label: "Signatures", value: stats.signatures, color: "text-rose-700", bg: "bg-rose-50" },
              { label: "Sub-stages Done", value: stats.subStageCompletions, color: "text-indigo-700", bg: "bg-indigo-50" },
            ].map((s) => (
              <div key={s.label} className={cn("rounded-md border border-gray-200 p-2 text-center", s.bg)}>
                <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Event timeline */}
          <div className="rounded-md border border-gray-200">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 bg-gray-50 border-b text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              <span>#</span>
              <span>Event</span>
              <span>Actor</span>
              <span>Timestamp</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {sorted.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-gray-400 italic">
                  No workflow events recorded yet.
                </div>
              ) : (
                sorted.map((entry, i) => {
                  const meta = ACTION_META[entry.action_type] || {
                    label: entry.action_type, icon: FileCheck2, color: "text-gray-500", bg: "bg-gray-50",
                  };
                  const Icon = meta.icon;
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 items-start text-xs border-b border-gray-100 last:border-0",
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      )}
                    >
                      <span className="text-gray-400 font-mono text-[10px] pt-0.5">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", meta.bg)}>
                            <Icon className={cn("w-2.5 h-2.5", meta.color)} />
                          </div>
                          <span className="font-medium text-gray-800">{meta.label}</span>
                        </div>
                        {entry.stage_name && (
                          <p className="text-[10px] text-gray-500 mt-0.5 pl-5">
                            {entry.stage_name}
                            {entry.sub_stage_name ? ` › ${entry.sub_stage_name}` : ""}
                          </p>
                        )}
                        {entry.details && (
                          <p className="text-[10px] text-gray-400 mt-0.5 pl-5 italic">{entry.details}</p>
                        )}
                      </div>
                      <span className="text-gray-600 text-[11px] truncate max-w-[120px]">
                        {entry.actor_name || "—"}
                      </span>
                      <span className="text-gray-500 text-[11px] whitespace-nowrap">
                        {entry.timestamp ? format(new Date(entry.timestamp), "MMM d, yyyy h:mm a") : "—"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Branding footer */}
          <div className="mykumpare-brand-footer flex items-center gap-1.5 text-[10px] text-gray-400 pt-2 border-t border-gray-100">
            <img src="/favicon.png" alt="" className="w-3 h-3" onError={(e) => { e.target.style.display = 'none'; }} />
            Powered by MyKumpare
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" size="sm" onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Printer className="w-3.5 h-3.5" /> Print / Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}