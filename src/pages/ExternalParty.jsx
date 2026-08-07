import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import QuestionnaireDialog from "@/components/questionnaires/QuestionnaireDialog";
import { useAuth } from "@/lib/AuthContext";
import { format, parseISO } from "date-fns";
import {
  ClipboardList, Clock, Building2, Calendar, CheckCircle2, Play, LogOut,
} from "lucide-react";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Submitted: "bg-purple-50 text-purple-700 border-purple-200",
  "Under Review": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const calcProgress = (item) => {
  if (!item.sections) return { total: 0, completed: 0, inProgress: 0, pct: 0 };
  let total = 0, completed = 0, inProgress = 0;
  item.sections.forEach((s) => {
    (s.sub_sections || []).forEach((ss) => {
      total++;
      if (ss.status === "completed") completed++;
      if (ss.status === "in_progress") inProgress++;
    });
  });
  return { total, completed, inProgress, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
};

/**
 * Dedicated page for External Party users.
 * Shows only questionnaires assigned to the logged-in external party contact.
 * The external party can open, answer, and submit questionnaires directly.
 */
export default function ExternalParty() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);

  const contactId = user?.linked_contact_id;

  const { data: questionnaires = [], isLoading } = useQuery({
    queryKey: ["external_party_questionnaires", contactId],
    queryFn: () => base44.entities.Questionnaire.filter(
      { assignee_contact_id: contactId },
      "-created_date",
      500
    ),
    enabled: !!contactId,
  });

  const active = useMemo(
    () => questionnaires.filter((q) => q.status !== "Completed"),
    [questionnaires]
  );
  const completed = useMemo(
    () => questionnaires.filter((q) => q.status === "Completed"),
    [questionnaires]
  );

  const handleLogout = () => logout();

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Questionnaire Portal</h1>
              <p className="text-[11px] text-white/60 leading-tight">
                {user?.full_name || user?.email}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-white/80 hover:text-white hover:bg-white/10"
            onClick={handleLogout}
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Welcome banner */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm font-medium text-indigo-800">
            Welcome, {user?.full_name || "Guest"}
          </p>
          <p className="text-xs text-indigo-600 mt-0.5">
            You have {active.length} active {active.length === 1 ? "questionnaire" : "questionnaires"} to complete.
            Click on a questionnaire below to start filling it in.
          </p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400 mt-2">Loading questionnaires…</p>
          </div>
        ) : questionnaires.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-700 mt-2">No questionnaires assigned</p>
            <p className="text-xs text-gray-400 mt-1">
              You don't have any questionnaires assigned to you yet. You'll receive an email
              notification when a new questionnaire is sent.
            </p>
          </div>
        ) : (
          <>
            {/* Active questionnaires */}
            {active.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-indigo-500" /> Active ({active.length})
                </h2>
                {active.map((item) => {
                  const prog = calcProgress(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-colors bg-white"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{item.name || "Untitled"}</p>
                          <p className="text-[10px] text-gray-400 truncate">{item.template_name}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${STATUS_STYLES[item.status] || ""}`}>
                          {item.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-2">
                        {item.firm_name && (
                          <span className="flex items-center gap-0.5">
                            <Building2 className="w-2.5 h-2.5" /> {item.firm_name}
                          </span>
                        )}
                        {item.due_date && (
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" /> Due: {fmtDate(item.due_date)}
                          </span>
                        )}
                      </div>
                      {prog.total > 0 && (
                        <div className="space-y-0.5">
                          <Progress value={prog.pct} className="h-1.5" />
                          <div className="text-right text-[9px] text-gray-400">
                            {prog.completed}/{prog.total} sections completed ({prog.pct}%)
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed questionnaires */}
            {completed.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Completed ({completed.length})
                </h2>
                {completed.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors bg-white opacity-75"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 truncate">{item.name || "Untitled"}</p>
                        <p className="text-[10px] text-gray-400 truncate">{item.firm_name}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                        Completed
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-[11px] text-gray-400 text-center pt-2">
          Everything you enter is saved automatically in the system.
        </p>
      </div>

      {/* Questionnaire dialog */}
      {selected && (
        <QuestionnaireDialog
          open={!!selected}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          editQuestionnaire={selected}
          user={user}
          firms={[]}
          contacts={[]}
          products={[]}
          isExternalParty={true}
        />
      )}
    </div>
  );
}