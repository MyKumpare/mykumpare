import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActivityTypePicker from "./ActivityTypePicker";
import SubjectPicker from "./SubjectPicker";
import { useAutoOriginator } from "./useAutoOriginator";
import OriginatorPicker, { FirmPickerDropdown } from "./OriginatorPicker";
import {
  Phone, Mail, Users, FileText, MoreHorizontal, ChevronDown, ChevronUp,
  Building2, User, Clock, AlertCircle, CheckCircle2, XCircle, Calendar,
  Paperclip, Link2, Plus, X, ClipboardList, Upload, UserPlus
} from "lucide-react";
import { format } from "date-fns";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "clean"],
  ],
};

const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];

const FIRM_TYPES_ORDER = [
  "Allocator", "Investment Consultant", "Investment Manager",
  "Manager of Managers", "Securities Brokerage", "Trade Organizations",
];

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy"); } catch { return dateStr; }
}

// ── Firm entry with inline contact picker & new-contact form ─────────────────
function FirmEntry({ entry, allContacts, onChange, onRemove, onFirmClick, onContactClick }) {
  const [addingContact, setAddingContact] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const firmContacts = allContacts.filter(
    c => !c.deleted_at && (c.firm_ids || []).includes(entry.firm_id) && !entry.contacts.find(ec => ec.contact_id === c.id)
  );

  const handleToggleContact = (contact) => {
    const already = entry.contacts.find(c => c.contact_id === contact.id);
    if (already) {
      onChange({ ...entry, contacts: entry.contacts.filter(c => c.contact_id !== contact.id) });
    } else {
      onChange({ ...entry, contacts: [...entry.contacts, { contact_id: contact.id, contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") }] });
    }
  };

  const handleCreateContact = async () => {
    if (!newFirst.trim() || !newLast.trim()) return;
    setSaving(true);
    const created = await base44.entities.Contact.create({
      first_name: newFirst.trim(), last_name: newLast.trim(),
      title: newTitle.trim() || undefined, firm_ids: [entry.firm_id],
    });
    queryClient.invalidateQueries({ queryKey: ["all_contacts_for_activities"] });
    onChange({ ...entry, contacts: [...entry.contacts, { contact_id: created.id, contact_name: [created.first_name, created.last_name].filter(Boolean).join(" ") }] });
    setAddingContact(false); setNewFirst(""); setNewLast(""); setNewTitle("");
    setSaving(false);
  };

  // All contacts for this firm (selected + available)
  const allFirmContacts = allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(entry.firm_id));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <button type="button"
          onClick={() => onFirmClick && onFirmClick({ id: entry.firm_id, name: entry.firm_name })}
          className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
          <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {entry.firm_name}
          {entry.firm_type_context && <span className="text-[10px] font-medium text-indigo-400 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">{entry.firm_type_context}</span>}
        </button>
        <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
      </div>

      {/* Contact checkboxes */}
      {allFirmContacts.length === 0 && !addingContact && (
        <p className="text-xs text-gray-400 italic px-1">No contacts on file for this firm.</p>
      )}
      {allFirmContacts.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Who was involved?</p>
          {allFirmContacts.length > 4 && (
            <input
              type="text"
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50 mb-1"
            />
          )}
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {allFirmContacts.filter(c => !contactSearch || [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().includes(contactSearch.toLowerCase())).map(c => {
              const selected = !!entry.contacts.find(ec => ec.contact_id === c.id);
              return (
                <button key={c.id} type="button" onClick={() => handleToggleContact(c)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors border ${selected ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-100 hover:bg-gray-50"}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                    {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                    {(c.first_name || "")[0]}{(c.last_name || "")[0]}
                  </div>
                  <div onClick={(e) => { e.stopPropagation(); onContactClick && onContactClick(c); }} className="cursor-pointer">
                    <p className="text-xs font-medium text-gray-800 hover:text-indigo-600 hover:underline">{[c.first_name, c.last_name].filter(Boolean).join(" ")}</p>
                    {c.title && <p className="text-[10px] text-gray-400">{c.title}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add new contact inline */}
      {!addingContact ? (
        <button type="button" onClick={() => setAddingContact(true)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-indigo-200 text-[10px] text-indigo-500 hover:bg-indigo-50 transition-colors">
          <UserPlus className="w-3 h-3" /> Add new contact for this firm
        </button>
      ) : (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={newFirst} onChange={e => setNewFirst(e.target.value)} className="h-7 text-xs" placeholder="First name *" />
            <Input value={newLast} onChange={e => setNewLast(e.target.value)} className="h-7 text-xs" placeholder="Last name *" />
          </div>
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-7 text-xs" placeholder="Title (optional)" />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setAddingContact(false)}>Cancel</Button>
            <Button type="button" size="sm" className="h-6 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!newFirst.trim() || !newLast.trim() || saving} onClick={handleCreateContact}>
              {saving ? "Saving..." : "Add & Select"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Associated Firms & Contacts editor ────────────────────────────────────────
function AssociatedFirmsEditor({ value = [], onChange, allFirms, onFirmClick, onContactClick }) {
  const queryClient = useQueryClient();
  // Own query so new contacts added inline are reflected immediately
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_activities"],
    queryFn: () => base44.entities.Contact.list(),
  });
  const [addingFirm, setAddingFirm] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [savingFirm, setSavingFirm] = useState(false);

  const handleAddFirm = ({ firm, firmType }) => {
    // Allow same firm to be added multiple times if different firm types
    const key = firmType ? `${firm.id}::${firmType}` : firm.id;
    if (value.find(e => e._key === key)) return;
    onChange([...value, { _key: key, firm_id: firm.id, firm_name: firm.name, firm_type_context: firmType || null, contacts: [] }]);
  };

  const handleCreateFirm = async () => {
    if (!newFirmName.trim()) return;
    setSavingFirm(true);
    const created = await base44.entities.Firm.create({ name: newFirmName.trim() });
    queryClient.invalidateQueries({ queryKey: ["all_firms_for_activities"] });
    onChange([...value, { firm_id: created.id, firm_name: created.name, contacts: [] }]);
    setAddingFirm(false); setNewFirmName("");
    setSavingFirm(false);
  };

  const handleUpdateEntry = (key, updated) => {
    onChange(value.map(e => (e._key || e.firm_id) === key ? updated : e));
  };

  const usedKeys = value.map(e => e._key || e.firm_id);
  const availableFirms = allFirms.filter(f => {
    if (f.deleted_at) return false;
    const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [null];
    // Show firm if at least one type context hasn't been added yet
    return types.some(t => {
      const key = t ? `${f.id}::${t}` : f.id;
      return !usedKeys.includes(key);
    });
  });

  return (
    <div className="space-y-2">
      {value.map((entry) => {
        const key = entry._key || entry.firm_id;
        return (
          <FirmEntry key={key} entry={entry} allContacts={allContacts}
            onChange={(updated) => handleUpdateEntry(key, updated)}
            onRemove={() => onChange(value.filter(e => (e._key || e.firm_id) !== key))}
            onFirmClick={onFirmClick} onContactClick={onContactClick} />
        );
      })}

      {/* Add existing firm picker */}
      {!addingFirm && (
        <FirmPickerDropdown availableFirms={availableFirms} onSelect={handleAddFirm}
          onAddNew={() => setAddingFirm(true)} />
      )}

      {/* Add new firm form */}
      {addingFirm && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-2.5 space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">New Firm</p>
          <Input value={newFirmName} onChange={e => setNewFirmName(e.target.value)} className="h-7 text-xs" placeholder="Firm name *" autoFocus />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { setAddingFirm(false); setNewFirmName(""); }}>Cancel</Button>
            <Button type="button" size="sm" className="h-6 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!newFirmName.trim() || savingFirm} onClick={handleCreateFirm}>
              {savingFirm ? "Saving..." : "Create Firm"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attachments manager ───────────────────────────────────────────────────────
function AttachmentsManager({ attachments = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const results = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      results.push({ id: crypto.randomUUID(), name: file.name, file_url, file_type: file.type, uploaded_at: new Date().toISOString() });
    }
    onChange([...attachments, ...results]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      {attachments.map(att => (
        <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs">
          <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <input className="flex-1 bg-transparent outline-none text-gray-700 min-w-0" value={att.name}
            onChange={e => onChange(attachments.map(a => a.id === att.id ? { ...a, name: e.target.value } : a))} />
          <button type="button" onClick={() => onChange(attachments.filter(a => a.id !== att.id))} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-3 h-3" /></button>
        </div>
      ))}
      <button type="button" onClick={() => fileRef.current?.click()}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
        <Upload className="w-3 h-3" /> {uploading ? "Uploading..." : "Attach file(s)"}
      </button>
      <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
    </div>
  );
}

// ── Assign-to modal ───────────────────────────────────────────────────────────
function AssignModal({ allFirms, allContacts, onAssign, onClose }) {
  const [selFirmId, setSelFirmId] = useState("");
  const firmContacts = useMemo(
    () => allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(selFirmId)),
    [allContacts, selFirmId]
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Assign Task</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Select Firm</Label>
          <Select value={selFirmId} onValueChange={setSelFirmId}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a firm..." /></SelectTrigger>
            <SelectContent>
              {allFirms.filter(f => !f.deleted_at).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
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
                  <button key={c.id} type="button"
                    onClick={() => onAssign(c, allFirms.find(f => f.id === selFirmId))}
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
  );
}

// ── Single task entry form ────────────────────────────────────────────────────
function TaskEntryForm({ idx, task, onChange, onRemove, showRemove, allFirms, allContacts, allActivities }) {
  const [assignOpen, setAssignOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 relative">
      {showRemove && (
        <button type="button" onClick={() => onRemove(idx)} className="absolute top-2.5 right-2.5 p-0.5 text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
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
          <Select value={task.status} onValueChange={(v) => onChange(idx, { ...task, status: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Assign To (optional)</Label>
        {task.assigned_to_contact_name ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium text-indigo-700">{task.assigned_to_contact_name}</span>
            {task.assigned_to_firm_name && <span className="text-indigo-400">· {task.assigned_to_firm_name}</span>}
            <button type="button" onClick={() => onChange(idx, { ...task, assigned_to_contact_id: "", assigned_to_contact_name: "", assigned_to_firm_id: "", assigned_to_firm_name: "" })} className="ml-auto text-indigo-300 hover:text-red-500"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setAssignOpen(true)}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
            <User className="w-3.5 h-3.5" /> Assign to a contact...
          </button>
        )}
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
              <SelectContent>
                {allActivities.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.activity_type}{a.subject ? ` – ${a.subject}` : ""} · {fmt(a.activity_date)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1"><Paperclip className="w-3 h-3 text-gray-400" /> Attachments</Label>
        <AttachmentsManager attachments={task.attachments || []} onChange={(atts) => onChange(idx, { ...task, attachments: atts })} />
      </div>
      {assignOpen && (
        <AssignModal allFirms={allFirms} allContacts={allContacts}
          onAssign={(contact, firm) => {
            onChange(idx, { ...task, assigned_to_contact_id: contact.id, assigned_to_contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" "), assigned_to_firm_id: firm?.id || "", assigned_to_firm_name: firm?.name || "" });
            setAssignOpen(false);
          }}
          onClose={() => setAssignOpen(false)} />
      )}
    </div>
  );
}

// ── Activity Log form ─────────────────────────────────────────────────────────
function ActivityLogForm({ onSaved, onCancel, allFirms, allContacts, onFirmClick, onContactClick }) {
  const queryClient = useQueryClient();
  const [originator, setOriginator] = useState({ firmId: "", firmName: "", firmType: null, contactId: "", contactName: "" });
  useAutoOriginator(allFirms, allContacts, setOriginator, originator);
  const [activityType, setActivityType] = useState("Call");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState("");
  const [associatedFirmsContacts, setAssociatedFirmsContacts] = useState([]);
  const [addTask, setAddTask] = useState(false);
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split("T")[0]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactActivity.create(data),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities", originator.contactId] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm", originator.firmId] });
      if (addTask && taskDesc && taskDesc !== "<p><br></p>") {
        const today = new Date().toISOString().split("T")[0];
        await base44.entities.FollowUpTask.create({
          originator_contact_id: originator.contactId,
          originator_contact_name: originator.contactName,
          originator_firm_id: originator.firmId || undefined,
          originator_firm_name: originator.firmName || undefined,
          activity_id: created.id,
          activity_label: `${activityType} – ${fmt(activityDate)}`,
          due_date: taskDueDate, task_description: taskDesc, status: "Not Started",
          status_date: today,
        });
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", originator.contactId] });
        queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", originator.firmId] });
      }
      onSaved();
    },
  });

  const canSave = originator.contactId && activityType && activityDate;

  return (
    <div className="space-y-4">
      {/* Originator */}
      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
        <OriginatorPicker allFirms={allFirms} allContacts={allContacts}
          firmId={originator.firmId} firmName={originator.firmName} firmType={originator.firmType}
          contactId={originator.contactId} contactName={originator.contactName}
          onChange={setOriginator} />
      </div>

      {/* Activity details */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Type</Label>
          <ActivityTypePicker
            value={activityType}
            onChange={setActivityType}
            placeholder="Select activity type..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Date</Label>
          <Input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Subject</Label>
        <SubjectPicker
          value={subjects}
          onChange={setSubjects}
          placeholder="Select subjects..."
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Notes</Label>
        <Textarea placeholder="Activity details..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-16 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1"><Building2 className="w-3 h-3 text-indigo-500" /> Associated Firms & Contacts</Label>
        <AssociatedFirmsEditor value={associatedFirmsContacts} onChange={setAssociatedFirmsContacts} allFirms={allFirms} onFirmClick={onFirmClick} onContactClick={onContactClick} />
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

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!canSave || createMutation.isPending}
          onClick={() => createMutation.mutate({
            contact_id: originator.contactId, activity_type: activityType, activity_date: activityDate,
            subjects: subjects, notes: notes.trim(), associated_firms_contacts: associatedFirmsContacts,
          })}>
          {createMutation.isPending ? "Saving..." : "Save Activity"}
        </Button>
      </div>
    </div>
  );
}

// ── Follow-up Tasks form ──────────────────────────────────────────────────────
function TasksForm({ onSaved, onCancel, allFirms, allContacts }) {
  const queryClient = useQueryClient();
  const [originator, setOriginator] = useState({ firmId: "", firmName: "", firmType: null, contactId: "", contactName: "" });
  useAutoOriginator(allFirms, allContacts, setOriginator, originator);
  const emptyTask = () => ({
    task_description: "", due_date: new Date().toISOString().split("T")[0], status: "Not Started",
    assigned_to_contact_id: "", assigned_to_contact_name: "", assigned_to_firm_id: "", assigned_to_firm_name: "",
    activity_id: "", activity_label: "", attachments: [],
  });
  const [tasks, setTasks] = useState([emptyTask()]);
  const [saving, setSaving] = useState(false);

  const handleChange = (idx, updated) => setTasks(prev => prev.map((t, i) => i === idx ? updated : t));
  const handleRemove = (idx) => setTasks(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!originator.contactId) return;
    const valid = tasks.filter(t => t.due_date && t.task_description && t.task_description !== "<p><br></p>");
    if (!valid.length) return;
    setSaving(true);
    for (const t of valid) {
      await base44.entities.FollowUpTask.create({
        originator_contact_id: originator.contactId, originator_contact_name: originator.contactName,
        due_date: t.due_date, task_description: t.task_description, status: t.status || "Not Started",
        assigned_to_contact_id: t.assigned_to_contact_id || undefined,
        assigned_to_contact_name: t.assigned_to_contact_name || undefined,
        assigned_to_firm_id: t.assigned_to_firm_id || undefined,
        assigned_to_firm_name: t.assigned_to_firm_name || undefined,
        activity_id: t.activity_id || undefined, activity_label: t.activity_label || undefined,
        attachments: t.attachments?.length ? t.attachments : undefined,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", originator.contactId] });
    queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", originator.firmId] });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
        <OriginatorPicker allFirms={allFirms} allContacts={allContacts}
          firmId={originator.firmId} firmName={originator.firmName} firmType={originator.firmType}
          contactId={originator.contactId} contactName={originator.contactName}
          onChange={setOriginator} />
      </div>
      <div className="space-y-2">
        {tasks.map((task, idx) => (
          <TaskEntryForm key={idx} idx={idx} task={task} onChange={handleChange} onRemove={handleRemove}
            showRemove={tasks.length > 1} allFirms={allFirms} allContacts={allContacts} allActivities={[]} />
        ))}
      </div>
      <button type="button" onClick={() => setTasks(prev => [...prev, emptyTask()])}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Another Task
      </button>
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={saving || !originator.contactId}
          onClick={handleSave}>
          {saving ? "Saving..." : `Save Task${tasks.length > 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function GlobalActivityLogModal({ open, onClose, onFirmClick, onContactClick }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) { setSaved(false); }
  }, [open]);

  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_activities"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: open,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_activities"],
    queryFn: () => base44.entities.Contact.list(),
    enabled: open,
  });

  if (!open) return null;

  const handleSaved = () => {
    setSaved(true);
    setTimeout(() => onClose(), 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">Log Activity</h2>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {saved ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-sm font-semibold text-gray-700">Saved successfully!</p>
            </div>
          ) : (
            <ActivityLogForm onSaved={handleSaved} onCancel={onClose} allFirms={allFirms} allContacts={allContacts} onFirmClick={onFirmClick} onContactClick={onContactClick} />
          )}
        </div>
      </div>
    </div>
  );
}