import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, X, CheckCircle2, Clock, AlertCircle, XCircle,
  User, Calendar, ClipboardList, Link2, Paperclip, Upload, FileText, ChevronDown, Building2
} from "lucide-react";
import { format } from "date-fns";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import TaskAssigneeEditor from "@/components/activity/TaskAssigneeEditor";
import TaskDetailModal from "@/components/activity/TaskDetailModal";

const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];

const STATUS_STYLES = {
  "Not Started":  { color: "text-gray-500",  bg: "bg-gray-100",   border: "border-gray-200",  icon: Clock },
  "In-process":   { color: "text-blue-600",  bg: "bg-blue-50",    border: "border-blue-200",  icon: AlertCircle },
  "Completed":    { color: "text-green-600", bg: "bg-green-50",   border: "border-green-200", icon: CheckCircle2 },
  "Cancelled":    { color: "text-red-500",   bg: "bg-red-50",     border: "border-red-200",   icon: XCircle },
};

const QUILL_MODULES = {
  toolbar: [
    [{ header: [false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "clean"],
  ],
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// ── File Attachments Manager ──────────────────────────────────────────────────
function AttachmentsManager({ attachments = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const newAtts = [...attachments];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newAtts.push({ id: `att_${Date.now()}_${Math.random().toString(36).slice(2)}`, name: file.name, file_url, file_type: file.type || file.name.split(".").pop(), uploaded_at: new Date().toISOString() });
    }
    onChange(newAtts);
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      {attachments.map(att => (
        <div key={att.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-200">
          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-indigo-600 hover:underline truncate">{att.name}</a>
          <button type="button" onClick={() => onChange(attachments.filter(a => a.id !== att.id))} className="text-gray-300 hover:text-red-500">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <label className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "Uploading..." : "Attach file(s)"}
        <input type="file" multiple className="hidden" onChange={handleFileSelect} disabled={uploading} />
      </label>
    </div>
  );
}

// ── Single-task sub-form ──────────────────────────────────────────────────────
function TaskEntryForm({ idx, task, onChange, onRemove, showRemove, allFirms, allContacts, allActivities, originatorFirmId, originatorFirmName }) {
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
          <ReactQuill theme="snow" value={task.task_description}
            onChange={(val) => onChange(idx, { ...task, task_description: val })}
            modules={QUILL_MODULES} placeholder="Describe the task..." style={{ minHeight: 80 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Due Date *</Label>
          <Input type="date" value={task.due_date} onChange={e => onChange(idx, { ...task, due_date: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Status</Label>
          <Select value={task.status} onValueChange={(v) => onChange(idx, { ...task, status: v, status_date: new Date().toISOString().split("T")[0] })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
          <User className="w-3 h-3 text-indigo-500" /> Assign To (firms & contacts)
        </Label>
        <TaskAssigneeEditor
          value={task.assigned_firms_contacts || []}
          onChange={(v) => onChange(idx, { ...task, assigned_firms_contacts: v })}
          allFirms={allFirms}
          allContacts={allContacts}
          originatorFirmId={originatorFirmId}
          originatorFirmName={originatorFirmName}
        />
      </div>

      {allActivities.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Link to Activity (optional)</Label>
          {task.activity_id ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
              <Link2 className="w-3.5 h-3.5 text-indigo-500" />
              <span className="flex-1 truncate text-indigo-700">{task.activity_label}</span>
              <button type="button" onClick={() => onChange(idx, { ...task, activity_id: "", activity_label: "" })} className="text-indigo-300 hover:text-red-500"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <Select value={task.activity_id || ""} onValueChange={(val) => {
              const act = allActivities.find(a => a.id === val);
              if (act) onChange(idx, { ...task, activity_id: val, activity_label: `${act.activity_type}${act.subject ? ` – ${act.subject}` : ""} (${fmt(act.activity_date)})` });
            }}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Link to an activity..." /></SelectTrigger>
              <SelectContent>{allActivities.map(a => <SelectItem key={a.id} value={a.id}>{a.activity_type}{a.subject ? ` – ${a.subject}` : ""} · {fmt(a.activity_date)}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
          <Paperclip className="w-3 h-3 text-gray-400" /> Attachments
        </Label>
        <AttachmentsManager attachments={task.attachments || []} onChange={(atts) => onChange(idx, { ...task, attachments: atts })} />
      </div>
    </div>
  );
}

// ── New-tasks form ────────────────────────────────────────────────────────────
function NewTasksForm({ contactId, contactName, contactFirmId, contactFirmName, onSaved, onCancel, allFirms, allContacts, allActivities = [] }) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const emptyTask = () => ({
    task_description: "", due_date: today, status: "Not Started", status_date: today,
    assigned_firms_contacts: [],
    activity_id: "", activity_label: "", attachments: [],
  });
  const [tasks, setTasks] = useState([emptyTask()]);
  const [saving, setSaving] = useState(false);

  const handleChange = (idx, updated) => setTasks(prev => prev.map((t, i) => i === idx ? updated : t));
  const handleRemove = (idx) => setTasks(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const valid = tasks.filter(t => t.due_date && t.task_description && t.task_description !== "<p><br></p>");
    if (!valid.length) return;
    setSaving(true);
    for (const t of valid) {
      const afc = t.assigned_firms_contacts || [];
      // Initialize assignments array with status for each contact
      const assignments = [];
      afc.forEach(entry => {
        (entry.contacts || []).forEach(c => {
          assignments.push({
            id: crypto.randomUUID(),
            contact_id: c.contact_id,
            contact_name: c.contact_name,
            firm_id: entry.firm_id,
            firm_name: entry.firm_name,
            status: t.status || "Not Started",
            status_date: today,
            notes: "",
          });
        });
      });
      
      // Derive primary assignee for quick-filter fields
      let primaryContactId, primaryContactName, primaryFirmId, primaryFirmName;
      for (const entry of afc) {
        if (entry.contacts?.length) {
          primaryContactId = entry.contacts[0].contact_id;
          primaryContactName = entry.contacts[0].contact_name;
          primaryFirmId = entry.firm_id;
          primaryFirmName = entry.firm_name;
          break;
        }
      }
      await base44.entities.FollowUpTask.create({
        originator_contact_id: contactId,
        originator_contact_name: contactName,
        originator_firm_id: contactFirmId || undefined,
        originator_firm_name: contactFirmName || undefined,
        due_date: t.due_date,
        task_description: t.task_description,
        status: t.status || "Not Started",
        status_date: t.status_date || today,
        assigned_firms_contacts: afc.length ? afc : undefined,
        assignments: assignments.length ? assignments : undefined,
        assigned_to_contact_id: primaryContactId || undefined,
        assigned_to_contact_name: primaryContactName || undefined,
        assigned_to_firm_id: primaryFirmId || undefined,
        assigned_to_firm_name: primaryFirmName || undefined,
        activity_id: t.activity_id || undefined,
        activity_label: t.activity_label || undefined,
        attachments: t.attachments?.length ? t.attachments : undefined,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
    queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", contactFirmId] });
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
          <TaskEntryForm key={idx} idx={idx} task={task} onChange={handleChange} onRemove={handleRemove}
            showRemove={tasks.length > 1} allFirms={allFirms} allContacts={allContacts} allActivities={allActivities}
            originatorFirmId={contactFirmId} originatorFirmName={contactFirmName} />
        ))}
      </div>
      <button type="button" onClick={() => setTasks(prev => [...prev, emptyTask()])}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Another Task
      </button>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : `Save Task${tasks.length > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ── Clickable task row (opens detail modal) ───────────────────────────────────
function TaskItem({ task, contactId, onOpenDetail }) {
  const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
  const StatusIcon = s.icon;
  const isRequested = task.originator_contact_id === contactId;
  const isAssignedToMe = task.assigned_to_contact_id === contactId || (task.assigned_firms_contacts || []).some(e => (e.contacts || []).some(c => c.contact_id === contactId));

  return (
    <button type="button" onClick={() => onOpenDetail(task)}
      className={`w-full rounded-lg border bg-white overflow-hidden text-left hover:shadow-sm transition-shadow ${s.border}`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${s.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>{task.status}</span>
            {isRequested && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Requested</span>}
            {isAssignedToMe && !isRequested && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Assigned to Me</span>}
            <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {fmt(task.due_date)}</span>
            {task.status_date && <span className="text-[10px] text-gray-400">· {fmt(task.status_date)}</span>}
            {task.assigned_to_contact_name && (
              <span className="text-[10px] text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                <User className="w-2.5 h-2.5" /> {task.assigned_to_contact_name}
              </span>
            )}
            {task.attachments?.length > 0 && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                <Paperclip className="w-2.5 h-2.5" /> {task.attachments.length}
              </span>
            )}
          </div>
          {task.task_description && (
            <div className="text-xs text-gray-600 mt-1 line-clamp-2 quill-preview" dangerouslySetInnerHTML={{ __html: task.task_description }} />
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

// ── Main exported section ────────────────────────────────────────────────────
export default function FollowUpTasksSection({ contactId, contactName, contactFirmId, contactFirmName, allActivities = [] }) {
  const [showForm, setShowForm] = useState(false);
  const [detailTask, setDetailTask] = useState(null);

  const { data: originatedTasks = [], isLoading: loadingOriginated } = useQuery({
    queryKey: ["follow_up_tasks", contactId],
    queryFn: () => base44.entities.FollowUpTask.filter({ originator_contact_id: contactId }, "-due_date"),
    enabled: !!contactId,
  });

  const { data: assignedTasks = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ["follow_up_tasks_assigned", contactId],
    queryFn: () => base44.entities.FollowUpTask.filter({ assigned_to_contact_id: contactId }, "-due_date"),
    enabled: !!contactId,
  });

  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_tasks"],
    queryFn: () => base44.entities.Firm.list(),
  });
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_tasks"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const assignedToMeTasks = assignedTasks.filter(t => t.originator_contact_id !== contactId);
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
      {/* Tasks Requested */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
            Follow-up Tasks Requested
            {originatedTasks.length > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{originatedTasks.length}</span>
            )}
          </h4>
          <Button type="button" variant="ghost" size="sm"
            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
            onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Task
          </Button>
        </div>

        {showForm && (
          <NewTasksForm
            contactId={contactId} contactName={contactName}
            contactFirmId={contactFirmId} contactFirmName={contactFirmName}
            onSaved={() => setShowForm(false)} onCancel={() => setShowForm(false)}
            allFirms={allFirms} allContacts={allContacts} allActivities={allActivities}
          />
        )}

        {isLoading ? (
          <div className="text-xs text-gray-400 italic py-3 text-center">Loading...</div>
        ) : originatedTasks.length === 0 && !showForm ? (
          <div className="text-xs text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">No follow-up tasks requested yet</div>
        ) : (
          <div className="space-y-2">
            {originatedTasks.map(task => (
              <TaskItem key={task.id} task={task} contactId={contactId} onOpenDetail={setDetailTask} />
            ))}
          </div>
        )}
      </div>

      {/* Tasks Assigned to This Contact */}
      {(assignedToMeTasks.length > 0 || loadingAssigned) && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-500" />
            Tasks Assigned to This Contact
            {assignedToMeTasks.length > 0 && (
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{assignedToMeTasks.length}</span>
            )}
          </h4>
          {loadingAssigned ? (
            <div className="text-xs text-gray-400 italic py-3 text-center">Loading...</div>
          ) : (
            <div className="space-y-2">
              {assignedToMeTasks.map(task => (
                <TaskItem key={task.id} task={task} contactId={contactId} onOpenDetail={setDetailTask} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        open={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onFirmClick={(firm) => {
          setDetailTask(null);
          // Navigate to firm - parent component should handle this
        }}
        onContactClick={(contact) => {
          setDetailTask(null);
          // Navigate to contact - parent component should handle this
        }}
      />
    </div>
  );
}