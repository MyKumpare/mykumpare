import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/hooks/useViewMode";
import ViewModeToggle from "@/components/common/ViewModeToggle";
import {
  ShieldCheck, Files, ClipboardCheck, FileText, Plus, ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";

/**
 * Combined Due Diligence navigation section.
 * Renders Due Diligence as a parent row with Documents, Forms, and Templates
 * as indented sub-items (expandable/collapsible).
 */
export default function DueDiligenceNavSection({
  documentsCount,
  onOpenDueDiligence,
  onAddDueDiligence,
  onOpenDocuments,
  onAddDocuments,
  onOpenForms,
  onAddForms,
  onOpenTemplates,
  onAddTemplates,
  forceExpanded,
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useViewMode("dueDiligence");

  // Counts
  const { data: ddRecords = [] } = useQuery({
    queryKey: ["picker_count", "DueDiligence"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 5000),
  });
  const ddCount = ddRecords.filter((x) => !x.deleted_at).length;

  const { data: questionnaires = [] } = useQuery({
    queryKey: ["questionnaires"],
    queryFn: () => base44.entities.Questionnaire.list("-created_date", 500),
  });
  const formsCount = questionnaires.length;

  const { data: templates = [] } = useQuery({
    queryKey: ["picker_count", "Template"],
    queryFn: () => base44.entities.Template.list("-created_date", 5000),
  });
  const templatesCount = templates.filter((x) => !x.deleted_at).length;

  const isExpanded = forceExpanded !== undefined ? forceExpanded : expanded;

  const subItems = [
    {
      label: "Documents",
      icon: Files,
      iconColor: "text-teal-500",
      count: documentsCount,
      onOpen: onOpenDocuments,
      onAdd: onAddDocuments,
      addLabel: "Add Document",
      addColor: "text-teal-600",
      addHoverColor: "hover:text-teal-700",
      addHoverBg: "hover:bg-teal-50",
    },
    {
      label: "Forms",
      icon: ClipboardCheck,
      iconColor: "text-violet-500",
      count: formsCount,
      onOpen: onOpenForms,
      onAdd: onAddForms,
      addLabel: "Add Form",
      addColor: "text-violet-600",
      addHoverColor: "hover:text-violet-700",
      addHoverBg: "hover:bg-violet-50",
    },
    {
      label: "Templates",
      icon: FileText,
      iconColor: "text-cyan-500",
      count: templatesCount,
      onOpen: onOpenTemplates,
      onAdd: onAddTemplates,
      addLabel: "Add Template",
      addColor: "text-cyan-600",
      addHoverColor: "hover:text-cyan-700",
      addHoverBg: "hover:bg-cyan-50",
    },
  ];

  return (
    <div className="mb-6">
      {/* Parent row: Due Diligence */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center group"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              : <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            }
          </button>
          <button onClick={onOpenDueDiligence} className="flex items-center gap-2 group">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Due Diligence</span>
            <span className="text-xs text-gray-400 font-normal">({ddCount})</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          {onAddDueDiligence && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
              onClick={onAddDueDiligence}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Due Diligence
            </Button>
          )}
        </div>
      </div>

      {/* Nested sub-items */}
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
          {subItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-between px-1 py-1 rounded-lg hover:bg-gray-50">
                <button onClick={item.onOpen} className="flex items-center gap-2 group flex-1">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <Icon className={`w-4 h-4 ${item.iconColor}`} />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">{item.label}</span>
                  <span className="text-xs text-gray-400 font-normal">({item.count ?? 0})</span>
                </button>
                {item.onAdd && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 ${item.addColor} ${item.addHoverColor} ${item.addHoverBg} gap-1 text-xs`}
                    onClick={item.onAdd}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {item.addLabel}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}