import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, ExternalLink, Loader2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Circle, badgeClass: "bg-gray-100 text-gray-600", iconClass: "text-gray-300" },
  reviewed: { label: "Reviewed", icon: Clock, badgeClass: "bg-blue-100 text-blue-700", iconClass: "text-blue-600" },
  completed: { label: "Completed", icon: CheckCircle2, badgeClass: "bg-emerald-100 text-emerald-700", iconClass: "text-emerald-600" },
};

const NEXT_STATUS = { pending: "reviewed", reviewed: "completed", completed: "pending" };

/**
 * Compact checklist widget shown on the firm summary page.
 * Aggregates documentation_checklist items across all DD records for the firm,
 * lets the user cycle status (pending → reviewed → completed) inline,
 * and persists changes back to the owning DueDiligence record.
 *
 * Props:
 *   firmId: string
 */
export default function FirmDdChecklistWidget({ firmId }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState({});
  const [savingId, setSavingId] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["due-diligence", firmId],
    queryFn: () => base44.entities.DueDiligence.filter({ firm_id: firmId }, "-created_date", 200),
    enabled: !!firmId,
  });

  // Build a flat list of checklist items, each tagged with its owning DD record
  const allItems = useMemo(() => {
    const list = [];
    (records || []).forEach((rec) => {
      (rec.documentation_checklist || []).forEach((item) => {
        list.push({
          ...item,
          dd_id: rec.id,
          dd_product_name: rec.product_name || "Unassigned",
          dd_status: rec.status,
        });
      });
    });
    return list;
  }, [records]);

  const completedCount = allItems.filter((it) => it.status === "completed").length;
  const reviewedCount = allItems.filter((it) => it.status === "reviewed").length;
  const progressPct = allItems.length > 0 ? Math.round((completedCount / allItems.length) * 100) : 0;

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const cycleStatus = async (item) => {
    const newStatus = NEXT_STATUS[item.status || "pending"];
    setSavingId(item.id);
    try {
      const rec = records.find((r) => r.id === item.dd_id);
      if (!rec) return;
      const updatedChecklist = (rec.documentation_checklist || []).map((it) =>
        it.id === item.id ? { ...it, status: newStatus } : it
      );
      await base44.entities.DueDiligence.update(rec.id, {
        documentation_checklist: updatedChecklist,
      });
      queryClient.invalidateQueries({ queryKey: ["due-diligence", firmId] });
      queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
      toast({ title: "Checklist updated", description: `${item.name}: ${STATUS_CONFIG[newStatus].label}`, duration: 1500 });
    } catch (err) {
      toast({ title: "Update failed", description: err.message || "Could not save status", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading checklist…
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-center">
        <ListChecks className="w-5 h-5 text-gray-300 mx-auto mb-1" />
        <p className="text-xs text-gray-500">No due diligence checklist items yet.</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Start a due diligence process to populate the checklist.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ListChecks className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 truncate">DD Checklist</span>
          <span className="text-[10px] text-gray-500 shrink-0">({allItems.length} items)</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-500">{completedCount}/{allItems.length} done</span>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[10px] font-medium text-indigo-700">{progressPct}%</span>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{completedCount} completed</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{reviewedCount} reviewed</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{allItems.length - completedCount - reviewedCount} pending</span>
      </div>

      {/* Items list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {allItems.map((item) => {
          const status = item.status || "pending";
          const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const isExpanded = expanded[item.id];
          const isSaving = savingId === item.id;
          const hasDoc = !!(item.document_url || item.document_id);

          return (
            <div key={item.id} className="rounded-md border border-gray-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-2">
                {/* Status cycle button */}
                <button
                  type="button"
                  onClick={() => cycleStatus(item)}
                  disabled={isSaving}
                  className="shrink-0 hover:scale-110 transition-transform disabled:opacity-50"
                  title={`Click to mark as ${STATUS_CONFIG[NEXT_STATUS[status]].label}`}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <StatusIcon className={cn("w-4 h-4", statusCfg.iconClass)} />
                  )}
                </button>

                {/* Expand toggle */}
                <button type="button" onClick={() => toggleExpand(item.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Name */}
                <span className={cn("text-xs font-medium flex-1 truncate", status === "completed" ? "text-emerald-700 line-through" : "text-gray-700")}>
                  {item.name || "Unnamed item"}
                </span>

                {/* Product tag */}
                <span className="text-[9px] text-gray-400 truncate max-w-[100px] shrink-0" title={item.dd_product_name}>
                  {item.dd_product_name}
                </span>

                {/* Doc indicator */}
                {hasDoc && (
                  <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-600 shrink-0" title={item.document_name}>
                    <FileText className="w-3 h-3" />
                  </a>
                )}

                {/* Status badge */}
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", statusCfg.badgeClass)}>
                  {statusCfg.label}
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="mt-1.5 pl-6 space-y-1">
                  {hasDoc ? (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                      <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate flex-1" title={item.document_name}>
                        {item.document_name}
                      </a>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">No document attached.</p>
                  )}
                  {item.add_date && (
                    <p className="text-[10px] text-gray-400">Added: {item.add_date}</p>
                  )}
                  <p className="text-[10px] text-gray-400">DD Status: {item.dd_status}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] mt-1"
                    onClick={() => cycleStatus(item)}
                    disabled={isSaving}
                  >
                    Mark as {STATUS_CONFIG[NEXT_STATUS[status]].label}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}