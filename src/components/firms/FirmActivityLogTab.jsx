import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, Mail, Users, FileText, MoreHorizontal,
  ChevronDown, ChevronUp, Building2, User,
  Clock, AlertCircle, CheckCircle2, XCircle, Calendar, Paperclip,
  Link2, FileText as FileIcon, Plus, X, ClipboardList, Trash2, UserPlus
} from "lucide-react";
import { format } from "date-fns";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Note", "Other"];
const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];

const ACTIVITY_ICONS = {
  Call:    { icon: Phone,          color: "text-blue-500",   bg: "bg-blue-50" },
  Email:   { icon: Mail,           color: "text-green-500",  bg: "bg-green-50" },
  Meeting: { icon: Users,          color: "text-purple-500", bg: "bg-purple-50" },
  Note:    { icon: FileText,       color: "text-amber-500",  bg: "bg-amber-50" },
  Other:   { icon: MoreHorizontal, color: "text-gray-500",   bg: "bg-gray-100" },
};

const STATUS_STYLES = {
  "Not Started": { color: "text-gray-500",  bg: "bg-gray-100",  border: "border-gray-200",  icon: Clock },
  "In-process":  { color: "text-blue-600",  bg: "bg-blue-50",   border: "border-blue-200",  icon: AlertCircle },
  "Completed":   { color: "text-green-600", bg: "bg-green-50",  border: "border-green-200", icon: CheckCircle2 },
  "Cancelled":   { color: "text-red-500",   bg: "bg-red-50",    border: "border-red-200",   icon: XCircle },
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// ── Contact picker / quick-add modal ────────────────────────────────────────
function ContactPickerModal({ firmId, firmName, firmContacts, onPick, onClose }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("pick"); // "pick" | "add"
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    const created = await base44.entities.Contact.create({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      title: title.trim() || undefined,
      firm_ids: [firmId],
    });
    queryClient.invalidateQueries({ queryKey: ["contacts_for_firm_activity", firmId] });
    setSaving(false);
    onPick({ id: created.id, first_name: created.first_name, last_name: created.last_name, title: created.title });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Select Contact for {firmName}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {mode === "pick" ? (
          <>
            {firmContacts.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-2">No contacts yet for this firm.</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {firmContacts.map(c => (
                  <button key={c.id} type="button" onClick={() => onPick(c)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-indigo-50 text-left transition-colors">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                      {(c.first_name || "")[0]}{(c.last_name || "")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{[c.first_name, c.last_name].filter(Boolean).join(" ")}</p>
                      {c.title && <p className="text-[10px] text-gray-400">{c.title}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setMode("add")}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Add a new contact for this firm
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">First Name *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-8 text-sm" placeholder="First..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Last Name *</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-8 text-sm" placeholder="Last..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Title (optional)</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" placeholder="e.g. Portfolio Manager" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMode("pick")}>Back</Button>
              <Button type="button" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={!firstName.trim() || !lastName.trim() || saving} onClick={handleAdd}>
                {saving ? "Saving..." : "Add & Select"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Activity Log form (mirrors ContactActivitiesTab's ActivityForm) ───────────
function FirmActivityForm({ firmId, firmName, contact, allFirms, allContacts, onSaved, onCancel }) {
  const queryClient = useQueryClient();
  const contactId = contact.id;
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  const [activityType, setActivityType] = useState("Call");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [addTask, setAddTask] = useState(false);
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split("T")[0]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactActivity.create(data),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities", contactId] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm", firmId] });
      if (addTask && taskDesc && taskDesc !== "<p><br></p>") {
        const label = `${activityType} – ${format(new Date(activityDate + "T00:00:00"), "MMM d, yyyy")}`;
        await base44.entities.FollowUpTask.create({
          originator_contact_id: contactId,
          originator_contact_name: contactName,
          activity_id: created.id,
          activity_label: label,
          due_date: taskDueDate,
          task_description: taskDesc,
          status: "Not Started",
        });
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
        queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", firmId] });
      }
      onSaved();
    },
  });

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-indigo-700">Log Activity</span>
          <span className="text-xs text-indigo-400 ml-1.5">for {contactName}</span>
        </div>
        <button type="button" onClick={onCancel}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Type</Label>
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Date</Label>
          <Input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Subject</Label>
        <Input placeholder="Brief subject..." value={subject} onChange={e => setSubject(e.target.value)} className="h-8 text-sm" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Notes</Label>
        <Textarea placeholder="Activity details..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-16 text-sm" />
      </div>

      {!addTask ? (
        <button type="button" onClick={() => setAddTask(true)}
          className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
          <ClipboardList className="w-3.5 h-3.5" /> Add a follow-up task for this activity
        </button>
      ) : (
        <div className="rounded-lg border border-indigo-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Follow-up Task</span>
            <button type="button" onClick={() => setAddTask(false)}><X className="w-3 h-3 text-gray-400 hover:text-red-500" /></button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Task Description *</Label>
            <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
              <ReactQuill theme="snow" value={taskDesc} onChange={setTaskDesc} modules={QUILL_MODULES} placeholder="Describe the task..." style={{ minHeight: 70 }} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Due Date</Label>
            <Input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!activityType || !activityDate || createMutation.isPending}
          onClick={() => createMutation.mutate({
            contact_id: contactId,
            activity_type: activityType,
            activity_date: activityDate,
            subject: subject.trim(),
            notes: notes.trim(),
            associated_firms_contacts: [{ firm_id: firmId, firm_name: firmName, contacts: [] }],
          })}>
          {createMutation.isPending ? "Saving..." : "Save Activity"}
        </Button>
      </div>
    </div>
  );
}

// ── Follow-up Task form (mirrors FollowUpTasksSection's NewTasksForm) ─────────
function FirmTaskForm({ firmId, firmName, contact, allFirms, allContacts, allActivities, onSaved, onCancel }) {
  const queryClient = useQueryClient();
  const contactId = contact.id;
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  const [taskDesc, setTaskDesc] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("Not Started");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!taskDesc || taskDesc === "<p><br></p>" || !dueDate) return;
    setSaving(true);
    await base44.entities.FollowUpTask.create({
      originator_contact_id: contactId,
      originator_contact_name: contactName,
      due_date: dueDate,
      task_description: taskDesc,
      status,
    });
    queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
    queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", firmId] });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-indigo-700">Add Follow-up Task</span>
          <span className="text-xs text-indigo-400 ml-1.5">for {contactName}</span>
        </div>
        <button type="button" onClick={onCancel}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Task Description *</Label>
        <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
          <ReactQuill theme="snow" value={taskDesc} onChange={setTaskDesc} modules={QUILL_MODULES} placeholder="Describe the task..." style={{ minHeight: 80 }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Due Date *</Label>
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={saving || !taskDesc || taskDesc === "<p><br></p>" || !dueDate} onClick={handleSave}>
          {saving ? "Saving..." : "Save Task"}
        </Button>
      </div>
    </div>
  );
}

// ── Expandable Activity Row ───────────────────────────────────────────────────
function ActivityRow({ activity }) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color, bg } = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.Other;
  const associated = activity.associated_firms_contacts || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">{activity.activity_type}</span>
            {activity.subject && <span className="text-xs text-gray-500 truncate">· {activity.subject}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
            {activity.activity_date ? fmt(activity.activity_date) : "—"}
            {activity.contact_name && (
              <span className="flex items-center gap-0.5 text-indigo-500">
                <User className="w-2.5 h-2.5" /> {activity.contact_name}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-3">
          {activity.notes
            ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.notes}</p>
            : <p className="text-xs text-gray-400 italic">No notes recorded.</p>}
          {associated.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Associated Firms & Contacts</p>
              {associated.map((entry, i) => (
                <div key={i} className="rounded-lg bg-purple-50 border border-purple-100 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                    <Building2 className="w-3 h-3" /> {entry.firm_name}
                  </div>
                  {entry.contacts?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.contacts.map(c => (
                        <span key={c.contact_id} className="text-[10px] bg-white text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {c.contact_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Expandable Task Row ───────────────────────────────────────────────────────
function TaskRow({ task }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
  const StatusIcon = s.icon;

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${s.border}`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${s.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>{task.status}</span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Due {fmt(task.due_date)}
            </span>
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
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
      </div>

      {expanded && (
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
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {task.originator_contact_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-amber-500" />
                Requested by <span className="font-medium text-gray-700 ml-0.5">{task.originator_contact_name}</span>
              </span>
            )}
            {task.assigned_to_contact_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-blue-500" />
                Assigned to <span className="font-medium text-gray-700 ml-0.5">{task.assigned_to_contact_name}</span>
                {task.assigned_to_firm_name && <span>· {task.assigned_to_firm_name}</span>}
              </span>
            )}
            {task.completion_date && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" /> Completed {fmt(task.completion_date)}
              </span>
            )}
          </div>
          {task.activity_label && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
              <Link2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Linked to: {task.activity_label}</span>
            </div>
          )}
          {task.attachments?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Attachments</p>
              {task.attachments.map(att => (
                <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <FileIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{att.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function FirmActivityLogTab({ firmId, firmName }) {
  const [activeSection, setActiveSection] = useState("activities");
  // "idle" | "picking-for-activity" | "picking-for-task" | "activity-form" | "task-form"
  const [uiState, setUiState] = useState("idle");
  const [selectedContact, setSelectedContact] = useState(null);

  const { data: allActivities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["all_activities_for_firm", firmId],
    queryFn: () => base44.entities.ContactActivity.list("-activity_date", 500),
    enabled: !!firmId,
  });

  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["all_tasks_for_firm", firmId],
    queryFn: () => base44.entities.FollowUpTask.list("-due_date", 500),
    enabled: !!firmId,
  });

  const { data: firmContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["contacts_for_firm_activity", firmId],
    queryFn: () => base44.entities.Contact.filter({ firm_ids: firmId }),
    enabled: !!firmId,
  });

  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_activities"],
    queryFn: () => base44.entities.Firm.list(),
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_activities"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const firmContactIds = useMemo(() => new Set(firmContacts.map(c => c.id)), [firmContacts]);

  const firmActivities = useMemo(() => {
    return allActivities
      .filter(a => {
        const contactBelongs = firmContactIds.has(a.contact_id);
        const firmMentioned = (a.associated_firms_contacts || []).some(e => e.firm_id === firmId);
        return contactBelongs || firmMentioned;
      })
      .map(a => {
        const contact = firmContacts.find(c => c.id === a.contact_id);
        return { ...a, contact_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : null };
      });
  }, [allActivities, firmContactIds, firmId, firmContacts]);

  const firmTasks = useMemo(() => {
    return allTasks.filter(t =>
      t.assigned_to_firm_id === firmId ||
      firmContactIds.has(t.originator_contact_id) ||
      firmContactIds.has(t.assigned_to_contact_id)
    );
  }, [allTasks, firmContactIds, firmId]);

  const handlePickContact = (contact) => {
    setSelectedContact(contact);
    if (uiState === "picking-for-activity") setUiState("activity-form");
    else if (uiState === "picking-for-task") setUiState("task-form");
  };

  const handleFormSaved = () => {
    setUiState("idle");
    setSelectedContact(null);
  };

  const handleCancel = () => {
    setUiState("idle");
    setSelectedContact(null);
  };

  const isLoading = loadingActivities || loadingTasks || loadingContacts;

  const sections = [
    { key: "activities", label: "Activity Logs", count: firmActivities.length },
    { key: "tasks", label: "Follow-up Tasks", count: firmTasks.length },
  ];

  const showingPicker = uiState === "picking-for-activity" || uiState === "picking-for-task";

  return (
    <div className="space-y-3">
      {/* Section toggle + action button */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg flex-1">
          {sections.map(s => (
            <button key={s.key} type="button" onClick={() => setActiveSection(s.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeSection === s.key ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {s.label}
              {s.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeSection === s.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500"
                }`}>{s.count}</span>
              )}
            </button>
          ))}
        </div>
        {uiState === "idle" && (
          <Button type="button" variant="ghost" size="sm"
            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs flex-shrink-0"
            onClick={() => { setActiveSection(activeSection); setUiState(activeSection === "activities" ? "picking-for-activity" : "picking-for-task"); }}>
            <Plus className="w-3.5 h-3.5" />
            {activeSection === "activities" ? "Log Activity" : "Add Task"}
          </Button>
        )}
      </div>

      {/* Contact picker modal */}
      {showingPicker && (
        <ContactPickerModal
          firmId={firmId}
          firmName={firmName}
          firmContacts={firmContacts.filter(c => !c.deleted_at)}
          onPick={handlePickContact}
          onClose={handleCancel}
        />
      )}

      {/* Inline form after contact selected */}
      {uiState === "activity-form" && selectedContact && (
        <FirmActivityForm
          firmId={firmId}
          firmName={firmName}
          contact={selectedContact}
          allFirms={allFirms}
          allContacts={allContacts}
          onSaved={handleFormSaved}
          onCancel={handleCancel}
        />
      )}

      {uiState === "task-form" && selectedContact && (
        <FirmTaskForm
          firmId={firmId}
          firmName={firmName}
          contact={selectedContact}
          allFirms={allFirms}
          allContacts={allContacts}
          allActivities={firmActivities}
          onSaved={handleFormSaved}
          onCancel={handleCancel}
        />
      )}

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-6 text-center">Loading...</div>
      ) : activeSection === "activities" ? (
        firmActivities.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
            No activity logs for this firm yet
          </div>
        ) : (
          <div className="space-y-2">
            {firmActivities.map(a => <ActivityRow key={a.id} activity={a} />)}
          </div>
        )
      ) : (
        firmTasks.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
            No follow-up tasks associated with this firm yet
          </div>
        ) : (
          <div className="space-y-2">
            {firmTasks.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )
      )}
    </div>
  );
}