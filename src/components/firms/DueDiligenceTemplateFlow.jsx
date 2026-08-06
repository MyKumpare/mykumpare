import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronDown, Check, Plus, Play, CheckCircle2, Circle,
  Clock, BarChart3, Calendar, X, ChevronRight, Lock,
  ShieldCheck, ShieldX, ShieldAlert, UserCheck,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SubStageItem from "./SubStageItem";
import DatePicker from "@/components/ui/date-picker";
import AddTemplateDialog from "@/components/templates/AddTemplateDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Template-driven due diligence flow.
 *
 * Key behaviors:
 *  - Sub-stages can be worked on in ANY order within a stage (non-sequential)
 *  - Stage "Complete" is available only when ALL sub-stages are completed
 *  - Supervisor must approve (approve/reject/on_hold) before a stage is completed
 *  - Stage 1 is unlocked from the start; stages 2+ are locked until the
 *    previous stage is completed (all sub-stages done + supervisor approved)
 *
 * Props:
 *   templateId, templateName, stages, startDate, currentStageIndex
 *   onTemplateSelect(id, name), onStartDateChange(date), onStagesChange(stages),
 *   onCurrentStageChange(index)
 *   primaryAnalystId, primaryAnalystName, teamMembers: [{ value, label }]
 */
export default function DueDiligenceTemplateFlow({
  templateId, templateName, stages, startDate, currentStageIndex,
  onTemplateSelect, onStartDateChange, onStagesChange, onCurrentStageChange,
  primaryAnalystId, primaryAnalystName, teamMembers = [],
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [expandedStages, setExpandedStages] = useState({});
  const [pendingSupervisor, setPendingSupervisor] = useState({}); // { [stageId]: contactId }

  const toggleExpand = (id) => setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => base44.entities.Template.list("-created_date", 5000),
  });

  const ddTemplates = useMemo(
    () => templates.filter(
      (t) => t.template_type === "Manager Due Diligence" && Array.isArray(t.stages) && t.stages.length > 0
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
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const completedCount = stagesList.filter((s) => s.completed).length;
  const progressPct = stagesList.length > 0 ? Math.round((completedCount / stagesList.length) * 100) : 0;
  const allComplete = stagesList.length > 0 && completedCount === stagesList.length;

  // ─── Stage gating & completion logic ───

  // A stage is unlocked if it's the first stage, or the previous stage is completed
  const isStageUnlocked = (index) => {
    if (index === 0) return true;
    const prev = stagesList[index - 1];
    return !!prev?.completed;
  };

  // Check if ALL sub-stages in a stage are completed
  const allSubStagesCompleted = (stage) => {
    const subs = stage.sub_stages || [];
    return subs.length > 0 && subs.every((ss) => (ss.status || "not_started") === "completed");
  };

  const handleSelectTemplate = (template) => {
    onTemplateSelect(template.id, template.name);
    const newStages = (template.stages || []).map((s) => ({
      id: s.id,
      name: s.name,
      completed: false,
      completed_date: null,
      start_date: null,
      end_date: null,
      supervisor_status: "pending",
      supervisor_contact_id: null,
      supervisor_name: null,
      supervisor_date: null,
      sub_stages: (s.sub_stages || []).map((ss) => ({
        id: ss.id,
        name: ss.name,
        start_date: null,
        end_date: null,
        status: "not_started",
        performed_by_contact_id: null,
        performed_by_name: null,
        assignments: [],
      })),
    }));
    onStagesChange(newStages);
    onCurrentStageChange(0);
    setOpen(false);
    setSearch("");
  };

  const handleStart = () => {
    if (!startDate) onStartDateChange(todayStr);
    onCurrentStageChange(0);
  };

  // Supervisor action: approve / reject / on_hold.
  // The supervisor_contact_id/name are preserved from when they were
  // assigned via "Submit for Approval" — this only changes the status.
  const handleSupervisorAction = (index, action) => {
    const newStages = stagesList.map((s, i) => {
      if (i !== index) return s;
      const updated = {
        ...s,
        supervisor_status: action,
        supervisor_date: todayStr,
      };
      // Mark the supervisor approval sub-step as completed
      if (s.sub_stages && s.sub_stages.length > 0) {
        updated.sub_stages = s.sub_stages.map((ss) => {
          if (ss.name && ss.name.toLowerCase().includes("supervisor")) {
            return {
              ...ss,
              status: "completed",
              end_date: todayStr,
              performed_by_contact_id: s.supervisor_contact_id,
              performed_by_name: s.supervisor_name,
            };
          }
          return ss;
        });
      }
      if (action === "approved") {
        updated.completed = true;
        updated.completed_date = todayStr;
        updated.end_date = todayStr;
      } else {
        updated.completed = false;
        updated.completed_date = null;
      }
      return updated;
    });
    onStagesChange(newStages);
  };

  // Assign a supervisor to a stage (submit for approval)
  const handleAssignSupervisor = (index, stageId) => {
    const supId = pendingSupervisor[stageId];
    if (!supId) return;
    const member = teamMembers.find((m) => m.value === supId);
    const newStages = stagesList.map((s, i) =>
      i === index
        ? { ...s, supervisor_contact_id: supId, supervisor_name: member?.label || "", supervisor_status: "pending", supervisor_date: todayStr }
        : s
    );
    onStagesChange(newStages);
    setPendingSupervisor((prev) => {
      const next = { ...prev };
      delete next[stageId];
      return next;
    });
  };

  // Remove the assigned supervisor (reset back to no supervisor)
  const handleResetSupervisor = (index) => {
    const newStages = stagesList.map((s, i) =>
      i === index
        ? { ...s, supervisor_contact_id: null, supervisor_name: null, supervisor_status: "pending", supervisor_date: null }
        : s
    );
    onStagesChange(newStages);
  };

  // Sub-stage change: update the sub-stage within its stage,
  // and auto-set stage start_date when a sub-stage is started
  const handleSubStageChange = (stageIndex, newSubStage) => {
    const newStages = stagesList.map((s, i) => {
      if (i !== stageIndex) return s;
      const newSubs = (s.sub_stages || []).map((ss) =>
        ss.id === newSubStage.id ? newSubStage : ss
      );
      const updates = {};
      if (newSubStage.status === "in_process" && !s.start_date) {
        updates.start_date = todayStr;
      }
      return { ...s, sub_stages: newSubs, ...updates };
    });
    onStagesChange(newStages);
  };

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

  // Supervisor status display config
  const SUP_STATUS = {
    pending: { label: "Awaiting Approval", icon: Clock, class: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", icon: ShieldCheck, class: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Rejected", icon: ShieldX, class: "text-red-600", badge: "bg-red-100 text-red-700" },
    on_hold: { label: "On Hold", icon: ShieldAlert, class: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
  };

  return (
    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3">
      {/* Header with progress icon */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700">Due Diligence Template</Label>
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
          <Button type="button" variant="outline" className="w-full justify-between h-9 text-sm font-normal">
            <span className={selectedTemplate ? "text-gray-900 truncate" : "text-gray-400"}>
              {selectedTemplate ? selectedTemplate.name : "Select due diligence template..."}
            </span>
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-2 border-b">
            <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" autoFocus />
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
                <button key={t.id} type="button" className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2" onClick={() => handleSelectTemplate(t)}>
                  <Check className={cn("w-3.5 h-3.5 shrink-0", templateId === t.id ? "opacity-100 text-indigo-600" : "opacity-0")} />
                  <div className="min-w-0">
                    <span className="truncate block">{t.name}</span>
                    <span className="text-[11px] text-gray-400">{(t.stages || []).length} stages</span>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t">
            <button type="button" className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium" onClick={() => { setAddTemplateOpen(true); setOpen(false); }}>
              <Plus className="w-3.5 h-3.5" /> Add New Template
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <AddTemplateDialog
        open={addTemplateOpen}
        onOpenChange={setAddTemplateOpen}
        onCreated={(created) => {
          if (created && created.template_type === "Manager Due Diligence" && Array.isArray(created.stages) && created.stages.length > 0) {
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
            <Label className="text-xs font-medium text-gray-600 shrink-0">Start Date</Label>
            <DatePicker value={startDate || todayStr} onChange={onStartDateChange} className="h-8 flex-1" />
          </div>

          {/* Overall progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Overall Progress</span>
              <span className="text-gray-500">{completedCount} / {stagesList.length} completed</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Start button */}
          {!isStarted && !allComplete && (
            <Button type="button" size="sm" className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleStart}>
              <Play className="w-3.5 h-3.5" /> Start Due Diligence
            </Button>
          )}

          {/* Stages list */}
          {isStarted && (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {stagesList.length > 0 && (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-gray-500 hover:text-gray-700 px-2" onClick={toggleAll}>
                    {allExpanded ? <><ChevronDown className="w-3 h-3" /> Collapse All</> : <><ChevronRight className="w-3 h-3" /> Expand All</>}
                  </Button>
                </div>
              )}
              {stagesList.map((stage, index) => {
                const unlocked = isStageUnlocked(index);
                const stageSubs = stage.sub_stages || [];
                const subsCompleted = stageSubs.length > 0 && stageSubs.every((ss) => (ss.status || "not_started") === "completed");
                const subsCompletedCount = stageSubs.filter((ss) => (ss.status || "not_started") === "completed").length;
                const subsProgressPct = stageSubs.length > 0 ? Math.round((subsCompletedCount / stageSubs.length) * 100) : 0;
                const supStatus = stage.supervisor_status || "pending";
                const supCfg = SUP_STATUS[supStatus] || SUP_STATUS.pending;
                const SupIcon = supCfg.icon;
                const isCompleted = !!stage.completed;

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 transition-colors space-y-2",
                      isCompleted && "bg-emerald-50 border-emerald-200",
                      !isCompleted && unlocked && "bg-[#F4F5FF] border-[#D1D1E0]",
                      !unlocked && "bg-gray-50 border-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Circular status icon */}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        isCompleted ? "bg-emerald-100" : !unlocked ? "bg-gray-100" : "bg-[#4B45A8]"
                      )}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : !unlocked ? (
                          <Lock className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>

                      {/* Expand toggle */}
                      {unlocked && (
                        <button type="button" onClick={() => toggleExpand(stage.id)} className="text-[#4B45A8] hover:text-[#3a3580] shrink-0">
                          {expandedStages[stage.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Stage label + progress */}
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-sm font-medium truncate block",
                          isCompleted ? "text-emerald-700" : unlocked ? "text-[#4B45A8]" : "text-gray-400"
                        )}>
                          Stage {index + 1}: {stage.name || "Unnamed"}
                        </span>
                        {isCompleted && stage.completed_date && (
                          <span className="text-[11px] text-emerald-500">Completed {stage.completed_date}</span>
                        )}
                        {!isCompleted && !unlocked && (
                          <span className="text-[11px] text-gray-400">Locked — complete previous stage first</span>
                        )}
                        {unlocked && !isCompleted && stageSubs.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="h-1 w-20 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-[#4B45A8] rounded-full transition-all" style={{ width: `${subsProgressPct}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-500">{subsCompletedCount}/{stageSubs.length} completed</span>
                          </div>
                        )}
                      </div>

                      {/* Supervisor status badge */}
                      {unlocked && !isCompleted && subsCompleted && (
                        stage.supervisor_contact_id && supStatus === "pending" ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1 bg-amber-100 text-amber-700">
                            <UserCheck className="w-2.5 h-2.5" /> Approval Request Submitted
                          </span>
                        ) : (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1", supCfg.badge)}>
                            <SupIcon className="w-2.5 h-2.5" /> {supCfg.label}
                          </span>
                        )
                      )}
                    </div>

                    {/* Sub-stages (only when unlocked) */}
                    {unlocked && expandedStages[stage.id] && (
                      <div className="pl-6 space-y-1">
                        {/* Stage dates */}
                        <div className="grid grid-cols-2 gap-2 mb-1">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] text-[#75758C]">Stage Start</Label>
                            <DatePicker value={stage.start_date || ""} onChange={(d) => {
                              const newStages = stagesList.map((s, i) => i === index ? { ...s, start_date: d } : s);
                              onStagesChange(newStages);
                            }} allowEmpty className="h-7 text-xs" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px] text-[#75758C]">Stage End</Label>
                            <DatePicker value={stage.end_date || ""} onChange={(d) => {
                              const newStages = stagesList.map((s, i) => i === index ? { ...s, end_date: d } : s);
                              onStagesChange(newStages);
                            }} allowEmpty className="h-7 text-xs" />
                          </div>
                        </div>

                        {/* Sub-stage items */}
                        {stageSubs.map((ss) => (
                          <SubStageItem
                            key={ss.id}
                            subStage={ss}
                            primaryAnalystId={primaryAnalystId}
                            primaryAnalystName={primaryAnalystName}
                            teamMembers={teamMembers}
                            onChange={(updated) => handleSubStageChange(index, updated)}
                          />
                        ))}

                        {/* Supervisor approval controls */}
                        {!isCompleted && subsCompleted && (
                          <div className="mt-2 p-2 rounded-md bg-amber-50 border border-amber-200 space-y-1.5">
                            {stage.supervisor_contact_id ? (
                              supStatus === "pending" ? (
                                <>
                                  <p className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" /> Awaiting approval from {stage.supervisor_name || "supervisor"}
                                  </p>
                                  <p className="text-[10px] text-amber-600">The supervisor can review all sub-stages above, then approve, reject, or put on hold.</p>
                                  <div className="flex gap-1.5 flex-wrap">
                                    <Button type="button" size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleSupervisorAction(index, "approved")}>
                                      <ShieldCheck className="w-3 h-3" /> Approve
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleSupervisorAction(index, "rejected")}>
                                      <ShieldX className="w-3 h-3" /> Reject
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => handleSupervisorAction(index, "on_hold")}>
                                      <ShieldAlert className="w-3 h-3" /> On Hold
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px] text-gray-500 hover:text-gray-700" onClick={() => handleResetSupervisor(index)}>
                                      Change
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <p className="text-[11px] font-medium flex items-center gap-1">
                                  <SupIcon className={cn("w-3 h-3", supCfg.class)} /> {stage.supervisor_name || "Supervisor"} — {supCfg.label}{stage.supervisor_date ? ` on ${stage.supervisor_date}` : ""}
                                </p>
                              )
                            ) : (
                              <>
                                <p className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Select Supervisor for Approval
                                </p>
                                <p className="text-[10px] text-amber-600">All sub-stages completed. Select a supervisor to review and approve this stage.</p>
                                <div className="flex gap-1.5 items-center">
                                  <Select
                                    value={pendingSupervisor[stage.id] || ""}
                                    onValueChange={(v) => setPendingSupervisor((prev) => ({ ...prev, [stage.id]: v }))}
                                  >
                                    <SelectTrigger className="h-7 text-xs flex-1">
                                      <SelectValue placeholder="Select supervisor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {teamMembers.map((m) => (
                                        <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white"
                                    disabled={!pendingSupervisor[stage.id]}
                                    onClick={() => handleAssignSupervisor(index, stage.id)}
                                  >
                                    <UserCheck className="w-3 h-3" /> Submit for Approval
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {!isCompleted && !subsCompleted && stageSubs.length > 0 && (
                          <div className="mt-1 p-1.5 rounded-md bg-gray-50 border border-gray-200">
                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> Complete all sub-stages to unlock supervisor approval
                            </p>
                          </div>
                        )}
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowProgressModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" /> Due Diligence Progress
              </h3>
              <button type="button" onClick={() => setShowProgressModal(false)}>
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            {selectedTemplate && (
              <p className="text-xs text-gray-500 mb-1">Template: <span className="font-medium text-gray-700">{selectedTemplate.name}</span></p>
            )}
            {startDate && (
              <p className="text-xs text-gray-500 mb-3">Started: <span className="font-medium text-gray-700">{startDate}</span></p>
            )}

            <div className="text-center mb-3">
              <div className="text-3xl font-bold text-indigo-600">{progressPct}%</div>
              <p className="text-xs text-gray-500 mt-1">{completedCount} of {stagesList.length} stages completed</p>
            </div>

            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="space-y-1.5 mt-4">
              {stagesList.map((stage, index) => {
                const unlocked = isStageUnlocked(index);
                const supStatus = stage.supervisor_status || "pending";
                const supCfg = SUP_STATUS[supStatus] || SUP_STATUS.pending;
                const SupIcon = supCfg.icon;
                return (
                  <div key={stage.id} className="flex items-center gap-2 text-xs">
                    {stage.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : !unlocked ? (
                      <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    )}
                    <span className={stage.completed ? "text-emerald-700" : unlocked ? "text-indigo-700 font-medium" : "text-gray-500"}>
                      Stage {index + 1}: {stage.name || "Unnamed"}
                      {stage.completed && stage.completed_date ? ` — ${stage.completed_date}` : ""}
                    </span>
                    {!stage.completed && unlocked && (
                      <span className={cn("ml-auto text-[10px] flex items-center gap-0.5", supCfg.class)}>
                        <SupIcon className="w-2.5 h-2.5" /> {supCfg.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="outline" size="sm" className="w-full mt-4" onClick={() => setShowProgressModal(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}