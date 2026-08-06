import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronDown, Check, Plus, Play, CheckCircle2, Circle,
  Clock, BarChart3, Calendar, X, ChevronRight,
} from "lucide-react";
import SubStagesEditor from "./SubStagesEditor";
import DatePicker from "@/components/ui/date-picker";
import AddTemplateDialog from "@/components/templates/AddTemplateDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Template-driven due diligence flow.
 * Replaces the manual stages editor with:
 *  - Searchable template dropdown (Manager Due Diligence templates with stages)
 *  - "Add New Template" via AddTemplateDialog
 *  - Auto start date (today, editable)
 *  - Start button → begins at Stage 1
 *  - Ordered stage progression (must complete in numerical order)
 *  - Per-stage and overall progress bars
 *  - Progress icon → modal with visual overview
 *
 * Props:
 *   templateId, templateName, stages, startDate, currentStageIndex
 *   onTemplateSelect(id, name), onStartDateChange(date), onStagesChange(stages),
 *   onCurrentStageChange(index)
 */
export default function DueDiligenceTemplateFlow({
  templateId, templateName, stages, startDate, currentStageIndex,
  onTemplateSelect, onStartDateChange, onStagesChange, onCurrentStageChange,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [expandedStages, setExpandedStages] = useState({});
  const toggleExpand = (id) => setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => base44.entities.Template.list("-created_date", 5000),
  });

  // Only Manager Due Diligence templates that have stages defined
  const ddTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.template_type === "Manager Due Diligence" &&
          Array.isArray(t.stages) &&
          t.stages.length > 0
      ),
    [templates]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return ddTemplates;
    return ddTemplates.filter((t) => (t.name || "").toLowerCase().includes(q));
  }, [ddTemplates, search]);

  const selectedTemplate = ddTemplates.find((t) => t.id === templateId);

  const stagesList = stages || [];
  const isStarted = !!startDate;
  const completedCount = stagesList.filter((s) => s.completed).length;
  const progressPct =
    stagesList.length > 0
      ? Math.round((completedCount / stagesList.length) * 100)
      : 0;
  const allComplete =
    stagesList.length > 0 && completedCount === stagesList.length;
  const allExpanded = stagesList.length > 0 && stagesList.every((s) => expandedStages[s.id]);
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedStages({});
    } else {
      const next = {};
      stagesList.forEach((s) => { next[s.id] = true; });
      setExpandedStages(next);
    }
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const handleSelectTemplate = (template) => {
    onTemplateSelect(template.id, template.name);
    // Copy template stages into DD record with completed=false
    const newStages = (template.stages || []).map((s) => ({
      id: s.id,
      name: s.name,
      completed: false,
      completed_date: null,
      sub_stages: (s.sub_stages || []).map((ss) => ({ id: ss.id, name: ss.name })),
    }));
    onStagesChange(newStages);
    onCurrentStageChange(0);
    setOpen(false);
    setSearch("");
  };

  const handleStart = () => {
    if (!startDate) {
      onStartDateChange(todayStr);
    }
    onCurrentStageChange(0);
  };

  const handleCompleteStage = (index) => {
    // Only the current stage can be completed (numerical order)
    if (index !== currentStageIndex) return;
    const newStages = stagesList.map((s, i) =>
      i === index
        ? { ...s, completed: true, completed_date: todayStr }
        : s
    );
    onStagesChange(newStages);
    // Advance to next stage if not last
    if (index < stagesList.length - 1) {
      onCurrentStageChange(index + 1);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3">
      {/* Header with progress icon */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700">
          Due Diligence Template
        </Label>
        {stagesList.length > 0 && (
          <button
            type="button"
            onClick={() => setShowProgressModal(true)}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Progress ({progressPct}%)
          </button>
        )}
      </div>

      {/* Template dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between h-9 text-sm font-normal"
          >
            <span
              className={selectedTemplate ? "text-gray-900 truncate" : "text-gray-400"}
            >
              {selectedTemplate
                ? selectedTemplate.name
                : "Select due diligence template..."}
            </span>
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-gray-400 italic">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 italic">
                {search ? "No templates found" : "No due diligence templates yet"}
              </div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => handleSelectTemplate(t)}
                >
                  <Check
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      templateId === t.id
                        ? "opacity-100 text-indigo-600"
                        : "opacity-0"
                    )}
                  />
                  <div className="min-w-0">
                    <span className="truncate block">{t.name}</span>
                    <span className="text-[11px] text-gray-400">
                      {(t.stages || []).length} stages
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
              onClick={() => {
                setAddTemplateOpen(true);
                setOpen(false);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Add New Template
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Add Template Dialog */}
      <AddTemplateDialog
        open={addTemplateOpen}
        onOpenChange={setAddTemplateOpen}
        onCreated={(created) => {
          if (
            created &&
            created.template_type === "Manager Due Diligence" &&
            Array.isArray(created.stages) &&
            created.stages.length > 0
          ) {
            handleSelectTemplate(created);
          }
        }}
      />

      {/* Template stages display */}
      {stagesList.length > 0 && (
        <div className="space-y-2">
          {/* Start date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <Label className="text-xs font-medium text-gray-600 shrink-0">
              Start Date
            </Label>
            <DatePicker
              value={startDate || todayStr}
              onChange={onStartDateChange}
              className="h-8 flex-1"
            />
          </div>

          {/* Overall progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Overall Progress</span>
              <span className="text-gray-500">
                {completedCount} / {stagesList.length} completed
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Start button */}
          {!isStarted && !allComplete && (
            <Button
              type="button"
              size="sm"
              className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleStart}
            >
              <Play className="w-3.5 h-3.5" /> Start Due Diligence
            </Button>
          )}

          {/* Stages list */}
          {isStarted && (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {stagesList.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-gray-500 hover:text-gray-700 px-2"
                    onClick={toggleAll}
                  >
                    {allExpanded ? (
                      <><ChevronDown className="w-3 h-3" /> Collapse All</>
                    ) : (
                      <><ChevronRight className="w-3 h-3" /> Expand All</>
                    )}
                  </Button>
                </div>
              )}
              {stagesList.map((stage, index) => {
                const isCurrent =
                  index === currentStageIndex && !stage.completed;
                const isUpcoming =
                  index > currentStageIndex && !stage.completed;

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "rounded-md border px-2 py-1.5 transition-colors space-y-1.5",
                      stage.completed && "bg-emerald-50 border-emerald-200",
                      isCurrent && "bg-indigo-50 border-indigo-300",
                      isUpcoming && "bg-gray-50 border-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Status icon */}
                      {stage.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                      )}

                      {/* Expand sub-stages */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(stage.id)}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                      >
                        {expandedStages[stage.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>

                      {/* Stage label */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={cn(
                            "text-sm font-medium truncate block",
                            stage.completed
                              ? "text-emerald-700"
                              : isCurrent
                                ? "text-indigo-700"
                                : "text-gray-500"
                          )}
                        >
                          Stage {index + 1}: {stage.name || "Unnamed"}
                        </span>
                        {stage.completed && stage.completed_date && (
                          <span className="text-[11px] text-emerald-500">
                            Completed {stage.completed_date}
                          </span>
                        )}
                      </div>

                      {/* Complete button — only for current stage */}
                      {isCurrent && !allComplete && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0 border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                          onClick={() => handleCompleteStage(index)}
                        >
                          Complete
                        </Button>
                      )}
                    </div>

                    {/* Sub-stages editor */}
                    {expandedStages[stage.id] && (
                      <div className="pl-6">
                        <SubStagesEditor
                          subStages={stage.sub_stages || []}
                          droppableId={`dd-subst-${stage.id}`}
                          onChange={(newSubs) => {
                            const newStages = stagesList.map((s, i) =>
                              i === index ? { ...s, sub_stages: newSubs } : s
                            );
                            onStagesChange(newStages);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* All complete message */}
          {allComplete && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              All stages completed!
            </div>
          )}
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowProgressModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                Due Diligence Progress
              </h3>
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            {selectedTemplate && (
              <p className="text-xs text-gray-500 mb-1">
                Template: <span className="font-medium text-gray-700">{selectedTemplate.name}</span>
              </p>
            )}
            {startDate && (
              <p className="text-xs text-gray-500 mb-3">
                Started: <span className="font-medium text-gray-700">{startDate}</span>
              </p>
            )}

            {/* Progress percentage */}
            <div className="text-center mb-3">
              <div className="text-3xl font-bold text-indigo-600">{progressPct}%</div>
              <p className="text-xs text-gray-500 mt-1">
                {completedCount} of {stagesList.length} stages completed
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Stage breakdown */}
            <div className="space-y-1.5 mt-4">
              {stagesList.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-2 text-xs">
                  {stage.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : index === currentStageIndex ? (
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  )}
                  <span
                    className={
                      stage.completed
                        ? "text-emerald-700"
                        : index === currentStageIndex
                          ? "text-indigo-700 font-medium"
                          : "text-gray-500"
                    }
                  >
                    Stage {index + 1}: {stage.name || "Unnamed"}
                    {stage.completed && stage.completed_date
                      ? ` — ${stage.completed_date}`
                      : ""}
                  </span>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={() => setShowProgressModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}