import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Phone, Mail, Users, FileText, MoreHorizontal, Trash2, X,
  ChevronDown, ChevronUp, ClipboardList, Link2, Link2Off, Building2, User
} from "lucide-react";
import { format } from "date-fns";
import FollowUpTasksSection from "./FollowUpTasksSection";
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

const ACTIVITY_ICONS = {
  Call: { icon: Phone, color: "text-blue-500", bg: "bg-blue-50" },
  Email: { icon: Mail, color: "text-green-500", bg: "bg-green-50" },
  Meeting: { icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
  Note: { icon: FileText, color: "text-amber-500", bg: "bg-amber-50" },
  Other: { icon: MoreHorizontal, color: "text-gray-500", bg: "bg-gray-100" },
};

// ── Searchable firm picker dropdown ──────────────────────────────────────────
function FirmPickerDropdown({ availableFirms, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedTypes, setExpandedTypes] = useState({});
  const ref = React.useRef(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const FIRM_TYPES = [
    "Allocator", "Investment Consultant", "Investment Manager",
    "Securities Brokerage", "Trade Organizations",
  ];

  const filtered = availableFirms.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.firm_types || [f.firm_type]).filter(Boolean).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  // Auto-expand all groups when searching
  const isSearching = search.trim().length > 0;

  // Group by type alphabetically; a firm with multiple types appears under each
  const grouped = {};
  FIRM_TYPES.forEach(t => { grouped[t] = []; });
  filtered.forEach(f => {
    const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : ["Other"];
    types.forEach(t => {
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(f);
    });
  });
  // Sort firms within each group
  Object.keys(grouped).forEach(t => grouped[t].sort((a, b) => a.name.localeCompare(b.name)));
  const activeTypes = Object.keys(grouped).filter(t => grouped[t].length > 0).sort();

  const toggleType = (t) => setExpandedTypes(prev => ({ ...prev, [t]: !prev[t] }));

  const handleSelect = (firm) => {
    onSelect(firm);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 h-7 px-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors bg-white"
      >
        <Plus className="w-3 h-3" /> Add a firm...
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search firms..."
              className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
            />
          </div>
          {/* Grouped list */}
          <div className="max-h-56 overflow-y-auto">
            {activeTypes.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">No firms found</p>
            ) : (
              activeTypes.map(type => (
                <div key={type}>
                  <button
                    type="button"
                    onClick={() => toggleType(type)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hover:bg-gray-50 transition-colors"
                  >
                    <span>{type}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{grouped[type].length}</span>
                      {(isSearching || expandedTypes[type]) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                  </button>
                  {(isSearching || expandedTypes[type]) && grouped[type].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelect(f)}
                      className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                    >
                      <Building2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                      {f.name}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Firm+Contact associator used inside ActivityForm ─────────────────────────
function AssociatedFirmsEditor({ value = [], onChange, allFirms, allContacts }) {
  const handleAddFirm = (firm) => {
    if (value.find(e => e.firm_id === firm.id)) return;
    onChange([...value, { firm_id: firm.id, firm_name: firm.name, contacts: [] }]);
  };

  const handleRemoveFirm = (firmId) => {
    onChange(value.filter(e => e.firm_id !== firmId));
  };

  const handleAddContact = (firmId, contact) => {
    onChange(value.map(e => {
      if (e.firm_id !== firmId) return e;
      if (e.contacts.find(c => c.contact_id === contact.id)) return e;
      return { ...e, contacts: [...e.contacts, { contact_id: contact.id, contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") }] };
    }));
  };

  const handleRemoveContact = (firmId, contactId) => {
    onChange(value.map(e => {
      if (e.firm_id !== firmId) return e;
      return { ...e, contacts: e.contacts.filter(c => c.contact_id !== contactId) };
    }));
  };

  const usedFirmIds = value.map(e => e.firm_id);
  const availableFirms = allFirms.filter(f => !f.deleted_at && !usedFirmIds.includes(f.id));

  return (
    <div className="space-y-2">
      {value.map((entry) => {
        const firmContacts = allContacts.filter(
          c => !c.deleted_at && (c.firm_ids || []).includes(entry.firm_id) && !entry.contacts.find(ec => ec.contact_id === c.id)
        );
        return (
          <div key={entry.firm_id} className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {entry.firm_name}
              </span>
              <button type="button" onClick={() => handleRemoveFirm(entry.firm_id)} className="text-gray-300 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
            {entry.contacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.contacts.map(c => (
                  <span key={c.contact_id} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                    <User className="w-2.5 h-2.5" /> {c.contact_name}
                    <button type="button" onClick={() => handleRemoveContact(entry.firm_id, c.contact_id)} className="ml-0.5 text-indigo-300 hover:text-red-500">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {firmContacts.length > 0 && (
              <Select onValueChange={(cid) => {
                const c = allContacts.find(x => x.id === cid);
                if (c) handleAddContact(entry.firm_id, c);
              }}>
                <SelectTrigger className="h-7 text-xs border-dashed border-gray-300 text-gray-500">
                  <SelectValue placeholder="+ Add contact from this firm..." />
                </SelectTrigger>
                <SelectContent>
                  {firmContacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ")}{c.title ? ` · ${c.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}

      {availableFirms.length > 0 && (
        <FirmPickerDropdown availableFirms={availableFirms} onSelect={handleAddFirm} />
      )}
    </div>
  );
}

function ActivityForm({ contactId, contactName, onSaved, onCancel, allFirms, allContacts }) {
  const queryClient = useQueryClient();
  const [activityType, setActivityType] = useState("Call");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const contact = (allContacts || []).find(c => c.id === contactId);
  const primaryFirmId = contact?.firm_ids?.[0];
  const firm = primaryFirmId ? (allFirms || []).find(f => f.id === primaryFirmId) : null;
  const firmTypes = firm?.firm_types?.length ? firm.firm_types : firm?.firm_type ? [firm.firm_type] : [];
  const [firmType, setFirmType] = useState(firmTypes.length === 1 ? firmTypes[0] : "");
  const [associatedFirmsContacts, setAssociatedFirmsContacts] = useState([]);
  const [addTask, setAddTask] = useState(false);
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split("T")[0]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactActivity.create(data),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities", contactId] });
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
          status_date: new Date().toISOString().split("T")[0],
        });
        queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
      }
      onSaved();
    },
  });

  const handleSave = () => {
    if (!activityType || !activityDate) return;
    createMutation.mutate({
      contact_id: contactId,
      activity_type: activityType,
      activity_date: activityDate,
      subject: subject.trim(),
      notes: notes.trim(),
      associated_firms_contacts: associatedFirmsContacts,
      firm_type: firmType || undefined,
    });
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">Log Activity</span>
        <button type="button" onClick={onCancel}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
      </div>

      {firmTypes.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-indigo-500" /> Firm Type Context <span className="text-red-500">*</span>
          </Label>
          <Select value={firmType} onValueChange={setFirmType}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select which firm type..." /></SelectTrigger>
            <SelectContent>{firmTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

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
          <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Subject</Label>
        <Input placeholder="Brief subject..." value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 text-sm" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-700">Notes</Label>
        <Textarea placeholder="Activity details..." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16 text-sm" />
      </div>

      {/* Associated Firms & Contacts */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-indigo-500" /> Associated Firms & Contacts
        </Label>
        <AssociatedFirmsEditor
          value={associatedFirmsContacts}
          onChange={setAssociatedFirmsContacts}
          allFirms={allFirms}
          allContacts={allContacts}
        />
      </div>

      {/* Follow-up task toggle */}
      {!addTask ? (
        <button
          type="button"
          onClick={() => setAddTask(true)}
          className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
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
            <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!activityType || !activityDate || (firmTypes.length > 1 && !firmType) || createMutation.isPending}
          onClick={handleSave}
        >
          {createMutation.isPending ? "Saving..." : "Save Activity"}
        </Button>
      </div>
    </div>
  );
}

function ActivityItem({ activity, contactId, contactName, linkedTasks, allActivities }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContactActivity.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact_activities", contactId] }),
  });

  const relinkTask = async (taskId, newActivityId, newActivityLabel) => {
    await base44.entities.FollowUpTask.update(taskId, {
      activity_id: newActivityId || undefined,
      activity_label: newActivityLabel || undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
  };

  const { icon: Icon, color, bg } = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.Other;
  const activityLabel = `${activity.activity_type}${activity.subject ? ` – ${activity.subject}` : ""} (${activity.activity_date ? format(new Date(activity.activity_date + "T00:00:00"), "MMM d, yyyy") : "—"})`;
  const associated = activity.associated_firms_contacts || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">{activity.activity_type}</span>
            {activity.subject && <span className="text-xs text-gray-500 truncate">· {activity.subject}</span>}
            {associated.length > 0 && (
              <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                <Building2 className="w-2.5 h-2.5" /> {associated.length} firm{associated.length > 1 ? "s" : ""}
              </span>
            )}
            {linkedTasks?.length > 0 && (
              <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                <ClipboardList className="w-2.5 h-2.5" /> {linkedTasks.length} task{linkedTasks.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {activity.activity_date ? format(new Date(activity.activity_date + "T00:00:00"), "MMM d, yyyy") : "—"}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-3">
          {activity.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.notes}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">No notes recorded.</p>
          )}

          {/* Associated firms/contacts */}
          {associated.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Associated Firms & Contacts</p>
              {associated.map(entry => (
                <div key={entry.firm_id} className="rounded-lg bg-purple-50 border border-purple-100 px-2.5 py-2 space-y-1">
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

          {/* Linked tasks */}
          {linkedTasks?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Linked Follow-up Tasks</p>
              {linkedTasks.map(task => (
                <LinkedTaskRow
                  key={task.id}
                  task={task}
                  activityLabel={activityLabel}
                  allActivities={allActivities}
                  onRelink={relinkTask}
                />
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => deleteMutation.mutate(activity.id)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkedTaskRow({ task, allActivities, onRelink }) {
  const [showRelink, setShowRelink] = useState(false);
  const statusColors = { "Not Started": "text-gray-500", "In-process": "text-blue-600", "Completed": "text-green-600", "Cancelled": "text-red-500" };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs">
      <ClipboardList className="w-3 h-3 text-indigo-400 flex-shrink-0" />
      <span className="flex-1 text-gray-700 truncate quill-preview" dangerouslySetInnerHTML={{ __html: task.task_description }} />
      <span className={`font-medium flex-shrink-0 ${statusColors[task.status] || "text-gray-500"}`}>{task.status}</span>
      <div className="relative flex-shrink-0">
        <button
          type="button"
          title="Change linked activity"
          onClick={() => setShowRelink(v => !v)}
          className="p-0.5 text-indigo-300 hover:text-indigo-600 transition-colors"
        >
          <Link2 className="w-3 h-3" />
        </button>
        {showRelink && (
          <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-xl shadow-xl w-56 p-2 space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase px-1 mb-1">Link to activity</p>
            <button
              onClick={() => { onRelink(task.id, null, null); setShowRelink(false); }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            >
              <Link2Off className="w-3 h-3" /> Unlink (make independent)
            </button>
            {allActivities.filter(a => a.id !== task.activity_id).map(a => (
              <button
                key={a.id}
                onClick={() => {
                  const lbl = `${a.activity_type}${a.subject ? ` – ${a.subject}` : ""} (${a.activity_date ? format(new Date(a.activity_date + "T00:00:00"), "MMM d, yyyy") : "—"})`;
                  onRelink(task.id, a.id, lbl);
                  setShowRelink(false);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg hover:bg-indigo-50 text-gray-700 transition-colors text-left"
              >
                <Link2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <span className="truncate">{a.activity_type}{a.subject ? ` – ${a.subject}` : ""} · {a.activity_date ? format(new Date(a.activity_date + "T00:00:00"), "MMM d, yyyy") : "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContactActivitiesTab({ contactId, contactName, contactFirmId, contactFirmName }) {
  const [showForm, setShowForm] = useState(false);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["contact_activities", contactId],
    queryFn: () => base44.entities.ContactActivity.filter({ contact_id: contactId }, "-activity_date"),
    enabled: !!contactId,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ["follow_up_tasks", contactId],
    queryFn: () => base44.entities.FollowUpTask.filter({ originator_contact_id: contactId }, "-due_date"),
    enabled: !!contactId,
  });

  const { data: allFirms = [] } = useQuery({
    queryKey: ["all_firms_for_activities"],
    queryFn: () => base44.entities.Firm.list(),
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_activities"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const tasksByActivity = useMemo(() => {
    const map = {};
    allTasks.forEach(t => {
      if (t.activity_id) {
        if (!map[t.activity_id]) map[t.activity_id] = [];
        map[t.activity_id].push(t);
      }
    });
    return map;
  }, [allTasks]);

  if (!contactId) {
    return (
      <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
        Save the contact first to log activities
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-3.5 h-3.5" /> Log Activity
        </Button>
      </div>

      {showForm && (
        <ActivityForm
          contactId={contactId}
          contactName={contactName}
          onSaved={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
          allFirms={allFirms}
          allContacts={allContacts}
        />
      )}

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No activities logged yet
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              contactId={contactId}
              contactName={contactName}
              linkedTasks={tasksByActivity[activity.id] || []}
              allActivities={activities}
            />
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <FollowUpTasksSection contactId={contactId} contactName={contactName} contactFirmId={contactFirmId} contactFirmName={contactFirmName} allActivities={activities} />
      </div>
    </div>
  );
}