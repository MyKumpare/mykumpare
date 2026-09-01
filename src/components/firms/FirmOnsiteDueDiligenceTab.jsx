import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Plus, Calendar, MapPin, Video, CheckCircle2, Clock, XCircle, UserX,
  Pencil, Trash2, FileText, ListChecks, Settings2, BarChart3, ExternalLink,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import OnsiteVisitDialog from "./OnsiteVisitDialog";
import OnsiteVisitRuleDialog from "./OnsiteVisitRuleDialog";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_STYLES = {
  Scheduled: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  Completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  Cancelled: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
  "No-show": { icon: UserX, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
};

export default function FirmOnsiteDueDiligenceTab({ firmId, firmName, firm }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [editingRule, setEditingRule] = useState(null);

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ["onsite-visits", firmId],
    queryFn: () => base44.entities.OnsiteVisit.filter({ firm_id: firmId }, "-target_visit_date", 200),
    enabled: !!firmId,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["onsite-visit-rules", firmId],
    queryFn: () => base44.entities.OnsiteVisitRule.filter({ firm_id: firmId }, "-created_date", 10),
    enabled: !!firmId,
  });

  const visitRule = rules[0] || null;
  const defaultAnalystId = firm?.primary_xponance_contact_id || "";
  const defaultAnalystName = firm?.primary_xponance_contact_name || "";

  const handleDeleteVisit = async (visit) => {
    if (!window.confirm(`Delete this visit (${fmtDate(visit.target_visit_date)})? This cannot be undone.`)) return;
    try {
      await base44.entities.OnsiteVisit.delete(visit.id);
      queryClient.invalidateQueries({ queryKey: ["onsite-visits", firmId] });
      toast({ title: "Visit deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteRule = async () => {
    if (!visitRule) return;
    if (!window.confirm("Delete the visit rule for this firm? The visit cycle report will no longer track this firm.")) return;
    try {
      await base44.entities.OnsiteVisitRule.delete(visitRule.id);
      queryClient.invalidateQueries({ queryKey: ["onsite-visit-rules", firmId] });
      setEditingRule(null);
      toast({ title: "Visit rule deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const completedVisits = visits.filter((v) => v.status === "Completed").sort((a, b) => (b.actual_visit_date || "").localeCompare(a.actual_visit_date || ""));
  const lastVisit = completedVisits[0];
  const nextDueDate = visitRule && lastVisit
    ? (() => { const d = new Date(lastVisit.actual_visit_date); d.setDate(d.getDate() + visitRule.visit_cycle_days); return d; })()
    : null;

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Onsite Due Diligence Visits</h3>
          <p className="text-xs text-gray-400">Track onsite and virtual visits, agendas, follow-ups, and visit cycle compliance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => navigate(`/OnsiteVisitReport`)}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Visit Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => { setEditingRule(visitRule); setRuleDialogOpen(true); }}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {visitRule ? "Edit Visit Rule" : "Create Visit Rule"}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1 bg-primary hover:bg-primary/90 text-white"
            onClick={() => { setEditingVisit(null); setVisitDialogOpen(true); }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Visit
          </Button>
        </div>
      </div>

      {/* Visit rule summary */}
      {visitRule && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-700">Visit Rule</span>
              </div>
              <span className="text-xs text-gray-600">
                Cycle: <strong>{visitRule.visit_cycle_days} days</strong>
                {visitRule.auto_deadline_days ? ` · Auto deadline: ${visitRule.auto_deadline_days} days` : ""}
              </span>
              <span className="text-xs text-gray-600">
                Default analyst: <strong>{visitRule.visiting_analyst_name || "—"}</strong>
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${visitRule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {visitRule.enabled ? "Active" : "Inactive"}
              </span>
            </div>
            <button onClick={handleDeleteRule} className="text-xs text-gray-400 hover:text-red-500">Delete rule</button>
          </div>
          {lastVisit && (
            <div className="mt-2 pt-2 border-t border-indigo-100 flex items-center gap-4 flex-wrap text-xs text-gray-600">
              <span>Last visit: <strong>{fmtDate(lastVisit.actual_visit_date)}</strong></span>
              {nextDueDate && (
                <span>Next due: <strong className={new Date() > nextDueDate ? "text-red-600" : "text-gray-700"}>{fmtDate(nextDueDate.toISOString())}</strong></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visit list */}
      {visitsLoading ? (
        <div className="text-sm text-gray-400 italic py-3 text-center">Loading visits...</div>
      ) : visits.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
          No onsite visits yet. Click "Add Visit" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map((visit) => {
            const st = STATUS_STYLES[visit.status] || STATUS_STYLES.Scheduled;
            const StatusIcon = st.icon;
            const TypeIcon = visit.onsite_type === "Virtual" ? Video : MapPin;
            const openItems = (visit.follow_up_items || []).filter((i) => !i.collected).length;
            const totalItems = (visit.follow_up_items || []).length;
            return (
              <div key={visit.id} className={`rounded-lg border ${st.border} ${st.bg} p-3`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Calendar className={`w-4 h-4 ${st.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{fmtDate(visit.target_visit_date)}</span>
                      {visit.actual_visit_date && visit.status === "Completed" && (
                        <span className="text-xs text-gray-500">(completed {fmtDate(visit.actual_visit_date)})</span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color} ${st.bg}`}>
                        <StatusIcon className="w-3 h-3" /> {visit.status}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <TypeIcon className="w-3 h-3" /> {visit.onsite_type}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-gray-600">
                      <span>Analyst: <strong>{visit.visiting_analyst_name || "—"}</strong></span>
                      {(visit.attachments || []).length > 0 && (
                        <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {(visit.attachments || []).length} doc{(visit.attachments || []).length !== 1 ? "s" : ""}</span>
                      )}
                      {totalItems > 0 && (
                        <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" /> {openItems}/{totalItems} follow-up items open</span>
                      )}
                      {(visit.follow_up_task_ids || []).length > 0 && (
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {(visit.follow_up_task_ids || []).length} task{(visit.follow_up_task_ids || []).length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {visit.agenda && (
                      <p className="mt-1.5 text-xs text-gray-600 line-clamp-2">{visit.agenda.replace(/<[^>]*>/g, "")}</p>
                    )}
                    {visit.notes && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-1"><span className="font-medium">Notes:</span> {visit.notes.replace(/<[^>]*>/g, "")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingVisit(visit); setVisitDialogOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600" title="Edit visit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteVisit(visit)} className="p-1.5 text-gray-400 hover:text-red-500" title="Delete visit">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <OnsiteVisitDialog
        open={visitDialogOpen}
        onOpenChange={setVisitDialogOpen}
        firm={{ id: firmId, name: firmName }}
        editingVisit={editingVisit}
        defaultAnalystId={defaultAnalystId}
        defaultAnalystName={defaultAnalystName}
        visitRule={visitRule}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["onsite-visits", firmId] })}
      />
      <OnsiteVisitRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        firmId={firmId}
        firmName={firmName}
        editingRule={editingRule}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["onsite-visit-rules", firmId] })}
      />
    </div>
  );
}