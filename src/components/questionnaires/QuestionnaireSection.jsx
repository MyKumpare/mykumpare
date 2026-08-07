import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/hooks/useViewMode";
import {
  ClipboardList, Plus, ChevronDown, ChevronRight, ExternalLink, Clock, Building2, User,
} from "lucide-react";
import { format, parseISO } from "date-fns";

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
 * Questionnaires section for the Home page.
 * Shows a collapsible header with count, and when expanded, displays
 * recent questionnaires with inline progress bars so the user can
 * quickly see how many sections are finished at a glance.
 *
 * Props:
 *   forceExpanded: boolean — parent controls expand/collapse all
 *   onOpen: () => void — open the full questionnaire picker modal
 *   onAdd: () => void — open the create questionnaire dialog
 */
export default function QuestionnaireSection({ forceExpanded, onOpen, onAdd }) {
  const { viewMode, setViewMode, toggleExpanded, isExpanded } = useViewMode("questionnaires", "list");
  const expanded = forceExpanded || isExpanded;

  const { data: questionnaires = [], isLoading } = useQuery({
    queryKey: ["questionnaires"],
    queryFn: () => base44.entities.Questionnaire.list("-created_date", 500),
  });

  const recent = useMemo(() => questionnaires.slice(0, 5), [questionnaires]);
  const activeCount = questionnaires.filter((q) => q.status !== "Completed").length;

  return (
    <div className="mb-3">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-violet-50/60 border border-violet-200 rounded-lg">
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          {expanded
            ? <ChevronDown className="w-4 h-4 text-violet-400" />
            : <ChevronRight className="w-4 h-4 text-violet-400" />
          }
          <ClipboardList className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-700">Questionnaires</span>
          <span className="text-[11px] text-gray-400">({questionnaires.length})</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-medium text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50" onClick={onOpen}>
            <ExternalLink className="w-3 h-3" /> Open
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50" onClick={onAdd}>
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>
      </div>

      {/* Inline progress bars when expanded */}
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-gray-400">Loading questionnaires…</div>
          ) : recent.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No questionnaires yet. Click "Add" to create one.</div>
          ) : (
            recent.map((item) => {
              const prog = calcProgress(item);
              return (
                <div
                  key={item.id}
                  onClick={onOpen}
                  className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-violet-300 hover:bg-violet-50/30 cursor-pointer transition-colors"
                >
                  {/* Name + metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-gray-700 truncate">{item.name || "Untitled"}</p>
                      <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${STATUS_STYLES[item.status] || ""}`}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-gray-400 mt-0.5">
                      {item.firm_name && (
                        <span className="flex items-center gap-0.5 truncate">
                          <Building2 className="w-2 h-2" /> {item.firm_name}
                        </span>
                      )}
                      {item.assignee_contact_name && (
                        <span className="flex items-center gap-0.5 truncate">
                          <User className="w-2 h-2" /> {item.assignee_contact_name}
                        </span>
                      )}
                      {item.due_date && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2 h-2" /> {fmtDate(item.due_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {prog.total > 0 ? (
                    <div className="w-28 flex-shrink-0">
                      <Progress value={prog.pct} className="h-1.5" />
                      <div className="text-right text-[8px] text-gray-400 mt-0.5">
                        {prog.completed}/{prog.total} done ({prog.pct}%)
                      </div>
                    </div>
                  ) : (
                    <span className="text-[9px] text-gray-300 flex-shrink-0">No sections</span>
                  )}
                </div>
              );
            })
          )}
          {questionnaires.length > 5 && (
            <button
              onClick={onOpen}
              className="w-full text-center text-[10px] text-violet-500 hover:text-violet-700 py-1"
            >
              View all {questionnaires.length} questionnaires →
            </button>
          )}
        </div>
      )}
    </div>
  );
}