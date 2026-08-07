import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import {
  ClipboardList, ChevronRight, Building2, Calendar, User, CheckCircle2,
  Eye, FileText, Loader2, ArrowLeft, Columns2,
} from "lucide-react";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MM/dd/yyyy"); } catch { return iso; }
};

const STATUS_CONFIG = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Submitted: "bg-purple-50 text-purple-700 border-purple-200",
  "Under Review": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const calcProgress = (item) => {
  if (!item.sections) return { total: 0, completed: 0, pct: 0 };
  let total = 0, completed = 0;
  item.sections.forEach((s) => {
    (s.sub_sections || []).forEach((ss) => {
      total++;
      if (ss.status === "completed") completed++;
    });
  });
  return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
};

export default function QuestionnaireReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState({});

  // Load all questionnaires in review-eligible statuses
  const { data: allQs = [], isLoading } = useQuery({
    queryKey: ["review_questionnaires"],
    queryFn: async () => {
      const [submitted, underReview, completed] = await Promise.all([
        base44.entities.Questionnaire.filter({ status: "Submitted" }, "-submitted_date", 200),
        base44.entities.Questionnaire.filter({ status: "Under Review" }, "-reviewed_date", 200),
        base44.entities.Questionnaire.filter({ status: "Completed" }, "-reviewed_date", 100),
      ]);
      return [...submitted, ...underReview, ...completed];
    },
  });

  const pendingReview = allQs.filter((q) => q.status === "Submitted" || q.status === "Under Review");
  const completedReview = allQs.filter((q) => q.status === "Completed");

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]
    );
  };

  const selectedQs = useMemo(
    () => selected.map((id) => allQs.find((q) => q.id === id)).filter(Boolean),
    [selected, allQs]
  );

  const handleStartReview = async (q) => {
    try {
      await base44.entities.Questionnaire.update(q.id, { status: "Under Review" });
      queryClient.invalidateQueries({ queryKey: ["review_questionnaires"] });
      toast({ title: "Review started", description: `"${q.name}" is now under review.` });
    } catch (err) {
      toast({ title: "Failed", description: err?.message, variant: "destructive" });
    }
  };

  const handleComplete = async (q) => {
    try {
      await base44.entities.Questionnaire.update(q.id, {
        status: "Completed",
        reviewed_date: format(new Date(), "yyyy-MM-dd"),
        reviewer_id: user?.id,
        reviewer_name: user?.full_name || "",
      });
      // Notify assignee
      await base44.entities.DdNotification.create({
        contact_id: q.assignee_contact_id,
        contact_name: q.assignee_contact_name,
        type: "questionnaire_completed",
        title: "Questionnaire review completed",
        message: `Your questionnaire "${q.name}" has been reviewed and marked as completed.`,
        questionnaire_id: q.id,
        firm_name: q.firm_name,
        product_name: q.product_name || undefined,
        status: "unread",
      });
      queryClient.invalidateQueries({ queryKey: ["review_questionnaires"] });
      toast({ title: "Completed", description: `"${q.name}" has been marked as completed.` });
    } catch (err) {
      toast({ title: "Failed", description: err?.message, variant: "destructive" });
    }
  };

  // Get all unique section names across selected questionnaires for comparison
  const comparisonSections = useMemo(() => {
    if (selectedQs.length < 2) return [];
    const sections = [];
    selectedQs.forEach((q) => {
      (q.sections || []).forEach((s) => {
        if (!sections.find((x) => x.id === s.id)) {
          sections.push({ id: s.id, name: s.name });
        }
      });
    });
    return sections;
  }, [selectedQs]);

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Breadcrumb */}
      <div className="bg-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 text-xs text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-indigo-600 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Dashboard
          </button>
          <ChevronRight className="w-3 h-3 text-gray-300" />
          <span className="text-gray-700 font-medium">Questionnaire Review</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Questionnaire Review Dashboard</h1>
              <p className="text-[11px] text-white/60">Compare and approve external party responses</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-white/80 hover:text-white hover:bg-white/10" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Review */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-500" /> Pending Review ({pendingReview.length})
                </h2>
                {selected.length >= 2 && (
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                    <Columns2 className="w-3 h-3 mr-1" /> {selected.length} selected for comparison
                  </Badge>
                )}
              </div>
              {pendingReview.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
                  No questionnaires pending review.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingReview.map((q) => {
                    const prog = calcProgress(q);
                    return (
                      <div key={q.id} className={`rounded-xl border bg-white p-4 transition-all ${selected.includes(q.id) ? "border-indigo-400 ring-1 ring-indigo-200" : "border-gray-200"}`}>
                        <div className="flex items-start gap-2">
                          <Checkbox checked={selected.includes(q.id)} onCheckedChange={() => toggleSelect(q.id)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{q.name || "Untitled"}</p>
                            <p className="text-[11px] text-gray-500 truncate">{q.firm_name}</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${STATUS_CONFIG[q.status] || ""}`}>{q.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-2">
                          <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {q.assignee_contact_name || "—"}</span>
                          {q.submitted_date && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> {fmtDate(q.submitted_date)}</span>}
                        </div>
                        {prog.total > 0 && (
                          <div className="space-y-0.5 mt-2">
                            <Progress value={prog.pct} className="h-1.5" />
                            <div className="text-right text-[9px] text-gray-400">{prog.completed}/{prog.total} ({prog.pct}%)</div>
                          </div>
                        )}
                        <div className="flex gap-1.5 mt-3">
                          {q.status === "Submitted" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleStartReview(q)}>
                              Start Review
                            </Button>
                          )}
                          <Button size="sm" className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleComplete(q)}>
                            <CheckCircle2 className="w-3 h-3" /> Approve
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Side-by-side comparison */}
            {selectedQs.length >= 2 && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                    <Columns2 className="w-3.5 h-3.5 text-indigo-500" /> Side-by-Side Comparison
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 w-40 align-top">Section</th>
                        {selectedQs.map((q) => (
                          <th key={q.id} className="text-left px-3 py-2 text-[11px] font-semibold text-gray-700 align-top min-w-[200px]">
                            <p className="truncate">{q.name}</p>
                            <p className="text-[9px] text-gray-400 font-normal truncate">{q.firm_name}</p>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonSections.map((section) => (
                        <React.Fragment key={section.id}>
                          <tr className="bg-gray-50/50">
                            <td colSpan={selectedQs.length + 1} className="px-3 py-1.5">
                              <button
                                onClick={() => setExpanded((p) => ({ ...p, [section.id]: !p[section.id] }))}
                                className="text-[11px] font-bold text-gray-600 flex items-center gap-1"
                              >
                                {expanded[section.id] ? "▼" : "▶"} {section.name}
                              </button>
                            </td>
                          </tr>
                          {expanded[section.id] && selectedQs.map((q) => {
                            const sec = (q.sections || []).find((s) => s.id === section.id);
                            const subs = sec?.sub_sections || [];
                            if (subs.length === 0) return null;
                            return subs.map((ss, idx) => (
                              <tr key={`${section.id}-${ss.id}-${idx}`} className="border-b border-gray-50">
                                {idx === 0 ? (
                                  <td rowSpan={subs.length} className="px-3 py-1 text-[11px] text-gray-500 align-top">
                                    {section.name}
                                  </td>
                                ) : null}
                                {selectedQs.map((qq) => {
                                  const qqSec = (qq.sections || []).find((s) => s.id === section.id);
                                  const qqSub = qqSec?.sub_sections?.[idx];
                                  const status = qqSub?.status || "not_started";
                                  return (
                                    <td key={qq.id} className="px-3 py-1.5 text-[11px] align-top">
                                      <div className="flex items-center gap-1 mb-0.5">
                                        {status === "completed" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                        {status === "in_progress" && <Loader2 className="w-3 h-3 text-blue-500" />}
                                        <span className="text-gray-400 text-[9px]">{status}</span>
                                      </div>
                                      {qqSub?.notes ? (
                                        <div className="text-gray-600 line-clamp-3 text-[10px]" dangerouslySetInnerHTML={{ __html: qqSub.notes }} />
                                      ) : (
                                        <span className="text-gray-300 text-[10px]">No response</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ));
                          }).flat()}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Completed */}
            {completedReview.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Completed ({completedReview.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  {completedReview.map((q) => (
                    <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-3 opacity-75">
                      <p className="text-xs font-medium text-gray-700 truncate">{q.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{q.firm_name}</p>
                      {q.reviewed_date && <p className="text-[9px] text-gray-400 mt-1">Reviewed: {fmtDate(q.reviewed_date)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}