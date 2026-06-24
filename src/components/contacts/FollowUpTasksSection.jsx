import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, X, ChevronDown, ChevronUp, Trash2, CheckCircle2, Clock, AlertCircle, XCircle,
  User, Building2, Calendar, ClipboardList, Edit2, Check
} from "lucide-react";
import { format } from "date-fns";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];

const STATUS_STYLES = {
  "Not Started":  { color: "text-gray-500",  bg: "bg-gray-100",   border: "border-gray-200",  icon: Clock },
  "In-process":   { color: "text-blue-600",  bg: "bg-blue-50",    border: "border-blue-200",  icon: AlertCircle },
  "Completed":    { color: "text-green-600", bg: "bg-green-50",   border: "border-green-200", icon: CheckCircle2 },
  "Cancelled":    { color: "text-red-500",   bg: "bg-red-50",     border: "border-red-200",   icon: XCircle },
};

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote"],
    ["clean"],
  ],
};

function dateInputToDisplay(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// ── Single-task sub-form used inside the multi-task form ──────────────────────
function TaskEntryForm({ idx, task, onChange, onRemove, showRemove, allFirms, allContacts }) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedFirmId, setSelectedFirmId] = useState(task.assigned_to_firm_id || "");

  const firmContacts = useMemo(
    () => allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(selectedFirmId)),
    [allContacts, selectedFirmId]
  );

  const handleAssign = (contact) => {
    const firm = allFirms.find(f => f.id === selectedFirmId);
    onChange(idx, {
      ...task,
      assigned_to_contact_id: contact.id,
      assigned_to_contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
      assigned_to_firm_id: selectedFirmId,
      assigned_to_firm_name: firm?.name || "",
    });
    setAssignModalOpen(false);
    setSelectedFirmId("");
  };

  const clearAssignment = () => {
    onChange(idx, { ...task, assigned_to_contact_id: "", assigned_to_contact_name: "", assigned_to_firm_id: "", assigned_to_firm_name: "" });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 relative">
      {showRemove && (
        <button type="button" onClick={() => onRemove(idx)} className="absolute top-2.5 right-2.5 p-0.5 text-gray-300 hover:text-red-500 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="flex items-center gap-2">
        <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs font-semibold text-gray-700">Task {idx + 1}</span>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Task Description *</Label>
        <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
          <ReactQuill
            theme="snow"
            value={task.task_description}
            onChange={(val) => onChange(idx, { ...task, task_description: val })}
            modules={QUILL_MODULES}
            placeholder="Describe the task..."
            style={{ minHeight: 80 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Due Date *</Label>
          <Input
            type="date"
            value={task.due_date}
            onChange={(e) => onChange(idx, { ...task, due_date: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Status</Label>
          <Select value={task.status} onValueChange={(v) => onChange(idx, { ...task, status: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignment */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Assign To (optional)</Label>
        {task.assigned_to_contact_name ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium text-indigo-700">{task.assigned_to_contact_name}</span>
            {task.assigned_to_firm_name && <span className="text-indigo-400">· {task.assigned_to_firm_name}</span>}
            <button type="button" onClick={clearAssignment} className="ml-auto text-indigo-300 hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAssignModalOpen(true)}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            <User className="w-3.5 h-3.5" /> Assign to a contact...
          </button>
        )}
      </div>

      {/* Assignment Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setAssignModalOpen(false); setSelectedFirmId(""); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">Assign Task</h3>
              <button onClick={() => { setAssignModalOpen(false); setSelectedFirmId(""); }}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Select Firm</Label>
              <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a firm..." /></SelectTrigger>
                <SelectContent>
                  {allFirms.filter(f => !f.deleted_at).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedFirmId && (
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Select Contact</Label>
                {firmContacts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2 text-center">No contacts found for this firm</p>
                ) : (
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {firmContacts.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAssign(c)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 text-left transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                          {(c.first_name || "")[0]}{(c.last_name || "")[0]}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-800">{[c.first_name, c.last_name].filter(Boolean).join(" ")}</p>
                          {c.title && <p className="text-[10px] text-gray-400">{c.title}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── New-tasks form (one or more tasks at once) ──────────────────────────────
function NewTasksForm({ contactId, contactName, onSaved, onCancel, allFirms, allContacts }) {
  const queryClient = useQueryClient();
  const emptyTask = () => ({ task_description: "", due_date: new Date().toISOString().split("T")[0], status: "Not Started", assigned_to_contact_id: "", assigned_to_contact_name: "", assigned_to_firm_id: "", assigned_to_firm_name: "" });
  const [tasks, setTasks] = useState([emptyTask()]);
  const [saving, setSaving] = useState(false);

  const handleChange = (idx, updated) => setTasks(prev => prev.map((t, i) => i === idx ? updated : t));
  const handleRemove = (idx) => setTasks(prev => prev.filter((_, i) => i !== idx));
  const handleAdd = () => setTasks(prev => [...prev, emptyTask()]);

  const handleSave = async () => {
    const valid = tasks.filter(t => t.due_date && t.task_description && t.task_description !== "<p><br></p>");
    if (!valid.length) return;
    setSaving(true);
    for (const t of valid) {
      await base44.entities.FollowUpTask.create({
        originator_contact_id: contactId,
        originator_contact_name: contactName,
        due_date: t.due_date,
        task_description: t.task_description,
        status: t.status || "Not Started",
        assigned_to_contact_id: t.assigned_to_contact_id || undefined,
        assigned_to_contact_name: t.assigned_to_contact_name || undefined,
        assigned_to_firm_id: t.assigned_to_firm_id || undefined,
        assigned_to_firm_name: t.assigned_to_firm_name || undefined,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
    // also refresh any assigned contact's tasks
    for (const t of valid) {
      if (t.assigned_to_contact_id) {
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", t.assigned_to_contact_id] });
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", t.assigned_to_contact_id] });
      }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">Add Follow-up Task(s)</span>
        <button type="button" onClick={onCancel}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
      </div>

      <div className="space-y-2">
        {tasks.map((task, idx) => (
          <TaskEntryForm
            key={idx}
            idx={idx}
            task={task}
            onChange={handleChange}
            onRemove={handleRemove}
            showRemove={tasks.length > 1}
            allFirms={allFirms}
            allContacts={allContacts}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Another Task
      </button>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : `Save Task${tasks.length > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ── Task detail/edit row ──────────────────────────────────────────────────────
function TaskItem({ task, contactId, allFirms, allContacts }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Edit state
  const [editStatus, setEditStatus] = useState(task.status);
  const [editNotes, setEditNotes] = useState(task.notes || "");
  const [editDueDate, setEditDueDate] = useState(task.due_date || "");
  const [editDesc, setEditDesc] = useState(task.task_description || "");
  const [editAssignedId, setEditAssignedId] = useState(task.assigned_to_contact_id || "");
  const [editAssignedName, setEditAssignedName] = useState(task.assigned_to_contact_name || "");
  const [editFirmId, setEditFirmId] = useState(task.assigned_to_firm_id || "");
  const [editFirmName, setEditFirmName] = useState(task.assigned_to_firm_name || "");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selFirmId, setSelFirmId] = useState("");

  const isAssignedToContact = !!task.assigned_to_contact_id;
  const isOriginator = !!task.originator_contact_id;

  const firmContacts = useMemo(
    () => allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(selFirmId)),
    [allContacts, selFirmId]
  );

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.FollowUpTask.update(task.id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", contactId] });
      // if status changed to Completed, refresh originator
      if (vars.status === "Completed" && task.originator_contact_id && task.originator_contact_id !== contactId) {
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", task.originator_contact_id] });
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", task.originator_contact_id] });
      }
      setEditMode(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.FollowUpTask.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", contactId] });
      if (task.assigned_to_contact_id) {
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", task.assigned_to_contact_id] });
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", task.assigned_to_contact_id] });
      }
    },
  });

  const handleSaveEdit = () => {
    const data = {
      status: editStatus,
      notes: editNotes,
      due_date: editDueDate,
      task_description: editDesc,
      assigned_to_contact_id: editAssignedId || undefined,
      assigned_to_contact_name: editAssignedName || undefined,
      assigned_to_firm_id: editFirmId || undefined,
      assigned_to_firm_name: editFirmName || undefined,
    };
    if (editStatus === "Completed" && !task.completion_date) {
      data.completion_date = new Date().toISOString().split("T")[0];
    }
    updateMutation.mutate(data);
  };

  const handleSelectAssignee = (contact) => {
    const firm = allFirms.find(f => f.id === selFirmId);
    setEditAssignedId(contact.id);
    setEditAssignedName([contact.first_name, contact.last_name].filter(Boolean).join(" "));
    setEditFirmId(selFirmId);
    setEditFirmName(firm?.name || "");
    setAssignOpen(false);
    setSelFirmId("");
  };

  const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
  const StatusIcon = s.icon;

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${s.border}`}>
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => { if (!editMode) setExpanded(e => !e); }}
      >
        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${s.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>{task.status}</span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Due {dateInputToDisplay(task.due_date)}
            </span>
            {task.assigned_to_contact_name && (
              <span className="text-[10px] text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                <User className="w-2.5 h-2.5" /> {task.assigned_to_contact_name}
              </span>
            )}
            {task.completion_date && (
              <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-2.5 h-2.5" /> Completed {dateInputToDisplay(task.completion_date)}
              </span>
            )}
          </div>
          {task.task_description && (
            <div
              className="text-xs text-gray-600 mt-1 line-clamp-2 quill-preview"
              dangerouslySetInnerHTML={{ __html: task.task_description }}
            />
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditMode(true); setExpanded(true); }}
            className="p-1 rounded text-gray-300 hover:text-indigo-600 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>

      {expanded && !editMode && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Task Description</p>
            <div className="text-sm text-gray-700 quill-preview" dangerouslySetInnerHTML={{ __html: task.task_description || "<em>—</em>" }} />
          </div>
          {task.notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <div className="text-sm text-gray-700 quill-preview" dangerouslySetInnerHTML={{ __html: task.notes }} />
            </div>
          )}
          {task.assigned_to_contact_name && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Building2 className="w-3 h-3" />
              Assigned to <span className="font-medium text-gray-700">{task.assigned_to_contact_name}</span>
              {task.assigned_to_firm_name && <span>· {task.assigned_to_firm_name}</span>}
            </div>
          )}
          {task.originator_contact_name && task.originator_contact_id !== contactId && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User className="w-3 h-3" />
              Assigned by <span className="font-medium text-gray-700">{task.originator_contact_name}</span>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}

      {expanded && editMode && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Due Date</Label>
              <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Task Description</Label>
            <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
              <ReactQuill theme="snow" value={editDesc} onChange={setEditDesc} modules={QUILL_MODULES} style={{ minHeight: 80 }} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Notes</Label>
            <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
              <ReactQuill theme="snow" value={editNotes} onChange={setEditNotes} modules={QUILL_MODULES} placeholder="Add notes..." style={{ minHeight: 80 }} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Assigned To</Label>
            {editAssignedName ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-medium text-indigo-700">{editAssignedName}</span>
                {editFirmName && <span className="text-indigo-400">· {editFirmName}</span>}
                <button type="button" onClick={() => { setEditAssignedId(""); setEditAssignedName(""); setEditFirmId(""); setEditFirmName(""); }} className="ml-auto text-indigo-300 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                <User className="w-3.5 h-3.5" /> Assign to a contact...
              </button>
            )}
          </div>

          {assignOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => { setAssignOpen(false); setSelFirmId(""); }} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">Assign Task</h3>
                  <button onClick={() => { setAssignOpen(false); setSelFirmId(""); }}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">Select Firm</Label>
                  <Select value={selFirmId} onValueChange={setSelFirmId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a firm..." /></SelectTrigger>
                    <SelectContent>
                      {allFirms.filter(f => !f.deleted_at).map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selFirmId && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">Select Contact</Label>
                    {firmContacts.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2 text-center">No contacts found for this firm</p>
                    ) : (
                      <div className="space-y-1 max-h-52 overflow-y-auto">
                        {firmContacts.map(c => (
                          <button key={c.id} type="button" onClick={() => handleSelectAssignee(c)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 text-left transition-colors">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                              {(c.first_name || "")[0]}{(c.last_name || "")[0]}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-800">{[c.first_name, c.last_name].filter(Boolean).join(" ")}</p>
                              {c.title && <p className="text-[10px] text-gray-400">{c.title}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditMode(false)}>Cancel</Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
            >
              <Check className="w-3 h-3 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main exported section ────────────────────────────────────────────────────
export default function FollowUpTasksSection({ contactId, contactName }) {
  const [showForm, setShowForm] = useState(false);

  // Tasks where this contact is the originator
  const { data: originatedTasks = [], isLoading: loadingOriginated } = useQuery({
    queryKey: ["follow_up_tasks", contactId],
    queryFn: () => base44.entities.FollowUpTask.filter({ originator_contact_id: contactId }, "-due_date"),
    enabled: !!contactId,
  });

  // Tasks assigned TO this contact (from others)
  const { data: assignedTasks = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ["follow_up_tasks_assigned", contactId],
    queryFn: () => base44.entities.FollowUpTask.filter({ assigned_to_contact_id: contactId }, "-due_date"),
    enabled: !!contactId,
  });

  // All firms & contacts for assignment picker
  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_tasks"],
    queryFn: () => base44.entities.Firm.list(),
  });
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_tasks"],
    queryFn: () => base44.entities.Contact.list(),
  });

  // Deduplicate: assigned tasks that are also originated by this contact already show in originatedTasks
  const pureAssigned = assignedTasks.filter(t => t.originator_contact_id !== contactId);

  const isLoading = loadingOriginated || loadingAssigned;

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the contact first to manage follow-up tasks
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* My Tasks (originated) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-indigo-500" /> My Follow-up Tasks
          </h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </Button>
        </div>

        {showForm && (
          <NewTasksForm
            contactId={contactId}
            contactName={contactName}
            onSaved={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
            allFirms={allFirms}
            allContacts={allContacts}
          />
        )}

        {isLoading ? (
          <div className="text-xs text-gray-400 italic py-3 text-center">Loading...</div>
        ) : originatedTasks.length === 0 && !showForm ? (
          <div className="text-xs text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
            No follow-up tasks yet
          </div>
        ) : (
          <div className="space-y-2">
            {originatedTasks.map(task => (
              <TaskItem key={task.id} task={task} contactId={contactId} allFirms={allFirms} allContacts={allContacts} />
            ))}
          </div>
        )}
      </div>

      {/* Assigned to me (from others) */}
      {pureAssigned.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-500" /> Assigned to Me
          </h4>
          <div className="space-y-2">
            {pureAssigned.map(task => (
              <TaskItem key={task.id} task={task} contactId={contactId} allFirms={allFirms} allContacts={allContacts} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}