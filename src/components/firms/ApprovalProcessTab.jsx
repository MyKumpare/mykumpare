import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatePicker from "@/components/ui/date-picker";
import StageNotesEditor from "./StageNotesEditor";
import { UserCheck, FileText, Plus, Trash2, ChevronDown, ChevronRight, Paperclip, Loader2, Link2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const generateId = () => `apl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * DD-level approval process execution tab.
 * - User selects an approver from their team
 * - Shows approval process logic steps (copied from template)
 * - For each step: start date (auto), performed by (auto user), attach documents
 *   (also saved to document tab), notes (rich text), assign tasks to team members
 *   (tasks show in notification tab and DD tab)
 *
 * Props:
 *   approvalProcess: { approver_contact_id, approver_name }
 *   logicSteps: [{ id, name, stage_id, stage_name, sub_stage_id, sub_stage_name,
 *     start_date, performed_by_contact_id, performed_by_name, documents, notes, task_assignments }]
 *   teamMembers: [{ value, label }]
 *   currentUserId, currentUserName
 *   firmId, firmName, productId, productName, tenantId
 *   onChangeProcess: (newProcess) => void
 *   onChangeLogic: (newSteps) => void
 */
export default function ApprovalProcessTab({
  approvalProcess = {}, logicSteps = [], teamMembers = [],
  currentUserId = "", currentUserName = "",
  firmId = "", firmName = "", productId = "", productName = "", tenantId = "",
  onChangeProcess, onChangeLogic,
}) {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleApproverChange = (contactId) => {
    const member = teamMembers.find((m) => m.value === contactId);
    onChangeProcess({
      ...approvalProcess,
      approver_contact_id: contactId,
      approver_name: member?.label || "",
    });
  };

  const updateStep = (id, changes) => {
    onChangeLogic(logicSteps.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  };

  const startStep = (step) => {
    const approverId = approvalProcess.approver_contact_id;
    const approverName = approvalProcess.approver_name;
    updateStep(step.id, {
      start_date: step.start_date || todayStr(),
      performed_by_contact_id: step.performed_by_contact_id || approverId || currentUserId,
      performed_by_name: step.performed_by_name || approverName || currentUserName,
    });
  };

  // ─── Document upload (also saves to FirmDocument) ───
  const handleFileUpload = async (stepId, file) => {
    const fileUrl = await base44.integrations.Core.UploadFile({ file });
    const docId = generateId();
    const newDoc = {
      id: docId,
      name: file.name,
      file_url: fileUrl?.file_url || "",
      file_type: file.type || file.name.split(".").pop() || "",
      uploaded_at: new Date().toISOString(),
    };

    // Also save as a FirmDocument record in the document tab
    let firmDocumentId = "";
    try {
      const firmDoc = await base44.entities.FirmDocument.create({
        firm_id: firmId,
        firm_name: firmName,
        tenant_id: tenantId,
        file_url: newDoc.file_url,
        file_name: newDoc.name,
        file_type: newDoc.file_type,
        entry_date: todayStr(),
        product_ids: productId ? [productId] : [],
      });
      firmDocumentId = firmDoc?.id || "";
    } catch (e) {
      console.error("Failed to create FirmDocument for approval process doc", e);
    }

    const step = logicSteps.find((s) => s.id === stepId);
    updateStep(stepId, {
      documents: [...(step?.documents || []), { ...newDoc, firm_document_id: firmDocumentId }],
    });
  };

  const removeDoc = (stepId, docId) => {
    const step = logicSteps.find((s) => s.id === stepId);
    updateStep(stepId, {
      documents: (step?.documents || []).filter((d) => d.id !== docId),
    });
  };

  // ─── Task assignments ───
  const addTask = (stepId) => {
    const step = logicSteps.find((s) => s.id === stepId);
    updateStep(stepId, {
      task_assignments: [...(step?.task_assignments || []), {
        id: generateId(),
        contact_id: "",
        contact_name: "",
        due_date: "",
        status: "not_started",
        status_date: todayStr(),
        notes: "",
      }],
    });
  };

  const updateTask = (stepId, taskId, changes) => {
    const step = logicSteps.find((s) => s.id === stepId);
    updateStep(stepId, {
      task_assignments: (step?.task_assignments || []).map((t) => (t.id === taskId ? { ...t, ...changes } : t)),
    });
  };

  const removeTask = (stepId, taskId) => {
    const step = logicSteps.find((s) => s.id === stepId);
    updateStep(stepId, {
      task_assignments: (step?.task_assignments || []).filter((t) => t.id !== taskId),
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-purple-200 bg-purple-50/30 p-3">
      <Label className="text-xs font-medium text-gray-700">Approval Process</Label>

      {/* Approver selection */}
      <div className="space-y-1">
        <Label className="text-[10px] text-gray-500">Select Approver from Team</Label>
        <Select
          value={approvalProcess.approver_contact_id || ""}
          onValueChange={handleApproverChange}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select approver..." />
          </SelectTrigger>
          <SelectContent>
            {teamMembers.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {approvalProcess.approver_contact_id && (
          <p className="text-[10px] text-purple-600 flex items-center gap-1">
            <UserCheck className="w-2.5 h-2.5" /> Approver: {approvalProcess.approver_name}
          </p>
        )}
      </div>

      {/* Approval process logic steps */}
      {logicSteps.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[10px] text-gray-500">Approval Process Logic</Label>
          {logicSteps.map((step, index) => {
            const isExpanded = expanded[step.id];
            const docs = step.documents || [];
            const tasks = step.task_assignments || [];

            return (
              <div key={step.id} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 space-y-1.5">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleExpand(step.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  <span className="text-[11px] text-gray-400 w-5 shrink-0">{index + 1}.</span>
                  <span className="text-xs font-medium flex-1 truncate text-gray-700">{step.name || "Unnamed step"}</span>
                  {/* Stage reference badge */}
                  {step.stage_name && (
                    <span className="text-[9px] px-1 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center gap-0.5 shrink-0">
                      <Link2 className="w-2 h-2" /> {step.stage_name}
                      {step.sub_stage_name ? ` › ${step.sub_stage_name}` : ""}
                    </span>
                  )}
                  {!step.start_date && (
                    <Button type="button" size="sm" variant="outline" className="h-5 text-[9px] px-1.5 shrink-0" onClick={() => startStep(step)}>
                      Start
                    </Button>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-1 space-y-2 pl-5">
                    {/* Start date + performed by */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-gray-500">Start Date</Label>
                        <DatePicker
                          value={step.start_date || ""}
                          onChange={(d) => updateStep(step.id, { start_date: d })}
                          allowEmpty
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-gray-500">Performed By</Label>
                        <Select
                          value={step.performed_by_contact_id || approvalProcess.approver_contact_id || currentUserId || ""}
                          onValueChange={(v) => {
                            const member = teamMembers.find((m) => m.value === v);
                            updateStep(step.id, { performed_by_contact_id: v, performed_by_name: member?.label || currentUserName });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select performer..." />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Documents */}
                    <DocUploadSection
                      docs={docs}
                      onUpload={(file) => handleFileUpload(step.id, file)}
                      onRemove={(docId) => removeDoc(step.id, docId)}
                    />

                    {/* Rich text notes */}
                    <StageNotesEditor
                      value={step.notes || ""}
                      onChange={(html) => updateStep(step.id, { notes: html })}
                      label="Notes"
                    />

                    {/* Task assignments */}
                    <TaskAssignmentSection
                      tasks={tasks}
                      teamMembers={teamMembers}
                      onAdd={() => addTask(step.id)}
                      onUpdate={(taskId, changes) => updateTask(step.id, taskId, changes)}
                      onRemove={(taskId) => removeTask(step.id, taskId)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {logicSteps.length === 0 && (
        <p className="text-[10px] text-gray-400 italic">No approval process logic steps. Select a template with process logic to populate.</p>
      )}
    </div>
  );
}

// ─── Sub-components ───

function DocUploadSection({ docs = [], onUpload, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-gray-500">Documents</Label>
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-indigo-600" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Paperclip className="w-2.5 h-2.5" />} Upload
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
      </div>
      {docs.length === 0 ? (
        <p className="text-[10px] text-gray-400 italic">No documents attached. Documents are also saved to the firm's document tab.</p>
      ) : (
        <div className="space-y-0.5">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-1">
              <FileText className="w-2.5 h-2.5 text-gray-400 shrink-0" />
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline truncate flex-1" title={doc.name}>
                {doc.name}
              </a>
              <button type="button" className="text-gray-300 hover:text-red-500 shrink-0" onClick={() => onRemove(doc.id)}>
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskAssignmentSection({ tasks = [], teamMembers = [], onAdd, onUpdate, onRemove }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-gray-500">Task Assignments</Label>
        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-indigo-600" onClick={onAdd}>
          <UserPlus className="w-2.5 h-2.5" /> Assign Task
        </Button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-[10px] text-gray-400 italic">No tasks assigned. Tasks appear in the assignee's notification tab and due diligence tab.</p>
      ) : (
        <div className="space-y-1">
          {tasks.map((task) => (
            <div key={task.id} className="rounded border border-gray-200 bg-white p-1.5 space-y-1">
              <div className="flex items-center gap-1">
                <Select
                  value={task.contact_id || undefined}
                  onValueChange={(v) => {
                    const member = teamMembers.find((m) => m.value === v);
                    onUpdate(task.id, { contact_id: v, contact_name: member?.label || "" });
                  }}
                >
                  <SelectTrigger className="h-6 text-[10px] flex-1">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-[10px]">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 shrink-0" onClick={() => onRemove(task.id)}>
                  <Trash2 className="w-2.5 h-2.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <Label className="text-[9px] text-gray-400">Due Date</Label>
                  <DatePicker value={task.due_date || ""} onChange={(d) => onUpdate(task.id, { due_date: d, status_date: todayStr() })} allowEmpty className="h-6 text-[10px]" />
                </div>
                <div>
                  <Label className="text-[9px] text-gray-400">Status</Label>
                  <Select value={task.status || "not_started"} onValueChange={(v) => onUpdate(task.id, { status: v, status_date: todayStr() })}>
                    <SelectTrigger className="h-6 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started" className="text-[10px]">Not Started</SelectItem>
                      <SelectItem value="in_process" className="text-[10px]">In Process</SelectItem>
                      <SelectItem value="completed" className="text-[10px]">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}