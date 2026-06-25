import React, { useState, useMemo, useRef, useEffect } from "react";
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
  Link2, Plus, X, ClipboardList, Trash2, UserPlus, Upload, Edit2, Check,
  ChevronLeft, ChevronRight
} from "lucide-react";
import TaskAssigneeEditor from "@/components/activity/TaskAssigneeEditor";
import TaskDetailModal from "@/components/activity/TaskDetailModal";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
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

// ── Contact picker / quick-add modal ─────────────────────────────────────────
function ContactPickerModal({ firmId, firmName, firmContacts, onPick, onClose }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("pick");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    const created = await base44.entities.Contact.create({
      first_name: firstName.trim(), last_name: lastName.trim(),
      title: title.trim() || undefined, firm_ids: [firmId],
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

// (AssignModal removed — replaced by TaskAssigneeEditor)

// ── Searchable firm picker ─────────────────────────────────────────────────────
// onSelect receives { firm, firmType }
function FirmPickerDropdown({ availableFirms, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedTypes, setExpandedTypes] = useState({});
  const [pendingFirm, setPendingFirm] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const FIRM_TYPES = ["Allocator", "Investment Consultant", "Investment Manager", "Manager of Managers", "Securities Brokerage", "Trade Organizations"];

  const filtered = availableFirms.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.firm_types || [f.firm_type]).filter(Boolean).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const isSearching = search.trim().length > 0;

  const grouped = {};
  FIRM_TYPES.forEach(t => { grouped[t] = []; });
  filtered.forEach(f => {
    const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : ["Other"];
    types.forEach(t => { if (!grouped[t]) grouped[t] = []; grouped[t].push(f); });
  });
  Object.keys(grouped).forEach(t => grouped[t].sort((a, b) => a.name.localeCompare(b.name)));
  const activeTypes = Object.keys(grouped).filter(t => grouped[t].length > 0).sort();

  const handleFirmClick = (f) => {
    const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
    if (types.length > 1) {
      setPendingFirm(f);
    } else {
      onSelect({ firm: f, firmType: types[0] || null });
      setOpen(false);
      setSearch("");
    }
  };

  const handleTypeConfirm = (type) => {
    onSelect({ firm: pendingFirm, firmType: type });
    setPendingFirm(null);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 h-7 px-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors bg-white">
        <Plus className="w-3 h-3" /> Add a firm...
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {pendingFirm ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setPendingFirm(null)} className="text-gray-400 hover:text-gray-600">
                  <ChevronDown className="w-3 h-3 rotate-90" />
                </button>
                <p className="text-xs font-semibold text-gray-700">{pendingFirm.name}</p>
              </div>
              <p className="text-[10px] text-gray-500">This firm has multiple types. Select which type context to use:</p>
              <div className="space-y-1">
                {(pendingFirm.firm_types?.length ? pendingFirm.firm_types : [pendingFirm.firm_type]).filter(Boolean).map(type => (
                  <button key={type} type="button" onClick={() => handleTypeConfirm(type)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-gray-700 text-left transition-colors">
                    <Building2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="font-medium">{type}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-gray-100">
                <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search firms..." className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50" />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {activeTypes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">No firms found</p>
                ) : activeTypes.map(type => (
                  <div key={type}>
                    <button type="button" onClick={() => setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hover:bg-gray-50 transition-colors">
                      <span>{type}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{grouped[type].length}</span>
                        {(isSearching || expandedTypes[type]) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </div>
                    </button>
                    {(isSearching || expandedTypes[type]) && grouped[type].map(f => (
                      <button key={f.id} type="button" onClick={() => handleFirmClick(f)}
                        className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left">
                        <Building2 className="w-3 h-3 text-indigo-400 flex-shrink-0" /> {f.name}
                        {(f.firm_types?.length > 1) && <span className="ml-auto text-[10px] text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">{f.firm_types.length} types</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline new-contact form for AssociatedFirmsEditor ────────────────────────
function InlineNewContactForm({ firmId, onCreated, onCancel }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    const created = await base44.entities.Contact.create({
      first_name: firstName.trim(), last_name: lastName.trim(),
      title: title.trim() || undefined, firm_ids: [firmId],
    });
    queryClient.invalidateQueries({ queryKey: ["all_contacts_for_activities"] });
    queryClient.invalidateQueries({ queryKey: ["contacts_for_firm_activity", firmId] });
    setSaving(false);
    onCreated(created);
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-7 text-xs" placeholder="First name *" autoFocus />
        <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-7 text-xs" placeholder="Last name *" />
      </div>
      <Input value={title} onChange={e => setTitle(e.target.value)} className="h-7 text-xs" placeholder="Title (optional)" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="h-6 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!firstName.trim() || !lastName.trim() || saving} onClick={handleSave}>
          {saving ? "Saving..." : "Add & Select"}
        </Button>
      </div>
    </div>
  );
}

// ── Associated Firms & Contacts editor (same as ContactActivitiesTab) ─────────
function AssociatedFirmsEditor({ value = [], onChange, allFirms, allContacts, onFirmClick, onContactClick }) {
  const [addingContactForFirm, setAddingContactForFirm] = useState(null);
  const [contactSearchByFirm, setContactSearchByFirm] = useState({});

  const handleAddFirm = ({ firm, firmType }) => {
    const key = firmType ? `${firm.id}::${firmType}` : firm.id;
    if (value.find(e => e._key === key)) return;
    onChange([...value, { _key: key, firm_id: firm.id, firm_name: firm.name, firm_type_context: firmType || null, contacts: [] }]);
  };
  const handleRemoveFirm = (key) => onChange(value.filter(e => (e._key || e.firm_id) !== key));
  const handleAddContact = (key, contact) => {
    onChange(value.map(e => {
      if ((e._key || e.firm_id) !== key) return e;
      if (e.contacts.find(c => c.contact_id === contact.id)) return e;
      return { ...e, contacts: [...e.contacts, { contact_id: contact.id, contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") }] };
    }));
  };
  const handleRemoveContact = (key, contactId) => {
    onChange(value.map(e => {
      if ((e._key || e.firm_id) !== key) return e;
      return { ...e, contacts: e.contacts.filter(c => c.contact_id !== contactId) };
    }));
  };

  const usedKeys = value.map(e => e._key || e.firm_id);
  const availableFirms = allFirms.filter(f => {
    if (f.deleted_at) return false;
    const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [null];
    return types.some(t => {
      const key = t ? `${f.id}::${t}` : f.id;
      return !usedKeys.includes(key);
    });
  });

  return (
    <div className="space-y-2">
      {value.map((entry) => {
        const entryKey = entry._key || entry.firm_id;
        const firmContacts = allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(entry.firm_id) && !entry.contacts.find(ec => ec.contact_id === c.id));
        const isAddingHere = addingContactForFirm === entryKey;
        return (
          <div key={entryKey} className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => onFirmClick && onFirmClick(allFirms.find(f => f.id === entry.firm_id))}
                className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {entry.firm_name}
                {entry.firm_type_context && <span className="text-[10px] font-medium text-indigo-400 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">{entry.firm_type_context}</span>}
              </button>
              <button type="button" onClick={() => handleRemoveFirm(entryKey)} className="text-gray-300 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
            {entry.contacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.contacts.map(c => (
                  <span key={c.contact_id} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                    <User className="w-2.5 h-2.5" />
                    <button type="button" onClick={() => onContactClick && onContactClick(allContacts.find(x => x.id === c.contact_id))}
                      className="hover:underline">{c.contact_name}</button>
                    <button type="button" onClick={() => handleRemoveContact(entryKey, c.contact_id)} className="ml-0.5 text-indigo-300 hover:text-red-500">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {firmContacts.length > 0 && (() => {
              const search = contactSearchByFirm[entryKey] || "";
              const filtered = firmContacts.filter(c =>
                !search || [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
              );
              return (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setContactSearchByFirm(prev => ({ ...prev, [entryKey]: e.target.value }))}
                    placeholder="Search contacts..."
                    className="w-full h-7 px-2.5 text-xs rounded-lg border border-dashed border-gray-300 outline-none focus:border-indigo-400 bg-white placeholder-gray-400"
                  />
                  {filtered.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-100">
                      {filtered.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { handleAddContact(entryKey, c); setContactSearchByFirm(prev => ({ ...prev, [entryKey]: "" })); }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                            {(c.first_name || "")[0]}{(c.last_name || "")[0]}
                          </div>
                          <span className="truncate">{[c.first_name, c.last_name].filter(Boolean).join(" ")}{c.title ? ` · ${c.title}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {search && filtered.length === 0 && (
                    <p className="text-[10px] text-gray-400 italic px-1">No contacts match "{search}"</p>
                  )}
                </div>
              );
            })()}
            {firmContacts.length === 0 && !isAddingHere && (
              <p className="text-xs text-gray-400 italic px-0.5">No contacts on file for this firm.</p>
            )}
            {isAddingHere ? (
              <InlineNewContactForm
                firmId={entry.firm_id}
                onCreated={(created) => { handleAddContact(entryKey, created); setAddingContactForFirm(null); }}
                onCancel={() => setAddingContactForFirm(null)}
              />
            ) : (
              <button type="button" onClick={() => setAddingContactForFirm(entryKey)}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-indigo-200 text-[10px] text-indigo-500 hover:bg-indigo-50 transition-colors">
                <UserPlus className="w-3 h-3" /> Add new contact for this firm
              </button>
            )}
          </div>
        );
      })}
      {availableFirms.length > 0 && <FirmPickerDropdown availableFirms={availableFirms} onSelect={handleAddFirm} />}
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
          <button type="button" onClick={() => onChange(attachments.filter(a => a.id !== att.id))} className="text-gray-300 hover:text-red-500 flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
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

// (TaskEntryForm replaced by inline TaskEntryInner inside FirmTaskForm)

// ── Activity form (full, mirrors ContactActivitiesTab's ActivityForm) ─────────
function FirmActivityForm({ firmId, firmName, contact, allFirms, allContacts, onSaved, onCancel, onFirmClick, onContactClick }) {
  const queryClient = useQueryClient();
  const contactId = contact.id;
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  const [activityType, setActivityType] = useState("Call");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [associatedFirmsContacts, setAssociatedFirmsContacts] = useState([{ _key: firmId, firm_id: firmId, firm_name: firmName, contacts: [] }]);
  const [addTask, setAddTask] = useState(false);
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split("T")[0]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactActivity.create(data),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities", contactId] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm", firmId] });
      if (addTask && taskDesc && taskDesc !== "<p><br></p>") {
        const label = `${activityType} – ${fmt(activityDate)}`;
        const today = new Date().toISOString().split("T")[0];
        await base44.entities.FollowUpTask.create({
          originator_contact_id: contactId, originator_contact_name: contactName,
          originator_firm_id: firmId, originator_firm_name: firmName,
          activity_id: created.id, activity_label: label,
          due_date: taskDueDate, task_description: taskDesc, status: "Not Started",
          status_date: today,
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
            <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-indigo-500" /> Associated Firms & Contacts
        </Label>
        <AssociatedFirmsEditor value={associatedFirmsContacts} onChange={setAssociatedFirmsContacts} allFirms={allFirms} allContacts={allContacts} onFirmClick={onFirmClick} onContactClick={onContactClick} />
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
          onClick={() => createMutation.mutate({ contact_id: contactId, activity_type: activityType, activity_date: activityDate, subject: subject.trim(), notes: notes.trim(), associated_firms_contacts: associatedFirmsContacts })}>
          {createMutation.isPending ? "Saving..." : "Save Activity"}
        </Button>
      </div>
    </div>
  );
}

// ── Task entry inner card (top-level so ReactQuill doesn't remount on re-render)
function TaskEntryInner({ idx, task, onChange, onRemove, showRemove, allFirms, allContacts, allActivities, originatorFirmId, originatorFirmName }) {
  const today = new Date().toISOString().split("T")[0];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 relative">
      {showRemove && (
        <button type="button" onClick={() => onRemove(idx)} className="absolute top-2.5 right-2.5 p-0.5 text-gray-300 hover:text-red-500">
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
          <Select value={task.status} onValueChange={(v) => onChange(idx, { ...task, status: v, status_date: today })}>
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
          allFirms={allFirms} allContacts={allContacts}
          originatorFirmId={originatorFirmId} originatorFirmName={originatorFirmName}
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
    </div>
  );
}

// ── Task form (uses TaskAssigneeEditor for multi-firm assignment) ─────────────
function FirmTaskForm({ firmId, firmName, contact, allFirms, allContacts, allActivities, onSaved, onCancel }) {
  const queryClient = useQueryClient();
  const contactId = contact.id;
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
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
        originator_contact_id: contactId, originator_contact_name: contactName,
        originator_firm_id: firmId, originator_firm_name: firmName,
        due_date: t.due_date, task_description: t.task_description,
        status: t.status || "Not Started",
        status_date: t.status_date || today,
        assigned_firms_contacts: afc.length ? afc : undefined,
        assigned_to_contact_id: primaryContactId || undefined,
        assigned_to_contact_name: primaryContactName || undefined,
        assigned_to_firm_id: primaryFirmId || undefined,
        assigned_to_firm_name: primaryFirmName || undefined,
        activity_id: t.activity_id || undefined, activity_label: t.activity_label || undefined,
        attachments: t.attachments?.length ? t.attachments : undefined,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", contactId] });
    queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", firmId] });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-indigo-700">Add Follow-up Task(s)</span>
          <span className="text-xs text-indigo-400 ml-1.5">for {contactName}</span>
        </div>
        <button type="button" onClick={onCancel}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" /></button>
      </div>
      <div className="space-y-2">
        {tasks.map((t, idx) => (
          <TaskEntryInner key={idx} idx={idx} task={t} onChange={handleChange} onRemove={handleRemove}
            showRemove={tasks.length > 1} allFirms={allFirms} allContacts={allContacts}
            allActivities={allActivities} originatorFirmId={firmId} originatorFirmName={firmName} />
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

// ── Clickable Activity Row ────────────────────────────────────────────────────
function ActivityRow({ activity, onOpen }) {
  const { icon: Icon, color, bg } = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.Other;
  const associated = activity.associated_firms_contacts || [];

  return (
    <button type="button" onClick={() => onOpen(activity)}
      className="w-full rounded-lg border border-gray-200 bg-white overflow-hidden text-left hover:bg-gray-50 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">{activity.activity_type}</span>
            {activity.subject && <span className="text-xs text-gray-500 truncate">· {activity.subject}</span>}
            {associated.length > 0 && (
              <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Building2 className="w-2.5 h-2.5" /> {associated.length} firm{associated.length > 1 ? "s" : ""}
              </span>
            )}
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
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
}

// ── Clickable Task Row (opens TaskDetailModal) ────────────────────────────────
function TaskRow({ task, onOpenDetail }) {
  const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
  const StatusIcon = s.icon;

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

// ── Calendar View Component ──────────────────────────────────────────────────
function ActivityCalendarView({ activities, currentMonth, onMonthChange, onOpenActivity }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();
  
  const prevMonth = () => onMonthChange(new Date(year, month - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, month + 1, 1));
  const goToToday = () => onMonthChange(new Date());
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const getActivitiesForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return activities.filter(a => a.activity_date === dateStr);
  };
  
  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 border border-gray-100" />);
  }
  
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(year, month, day);
    const dayActivities = getActivitiesForDate(currentDate);
    const isToday = new Date().toDateString() === currentDate.toDateString();
    
    days.push(
      <div key={day} className={`h-24 border border-gray-100 p-1 overflow-y-auto ${isToday ? "bg-indigo-50" : "bg-white"}`}>
        <div className={`text-xs font-semibold mb-1 ${isToday ? "text-indigo-700" : "text-gray-700"}`}>
          {day}
        </div>
        <div className="space-y-0.5">
          {dayActivities.slice(0, 3).map((activity, idx) => {
            const { icon: Icon, color, bg } = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.Other;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenActivity(activity)}
                className={`w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[9px] ${bg} hover:opacity-80 transition-opacity`}
              >
                <Icon className={`w-2.5 h-2.5 flex-shrink-0 ${color}`} />
                <span className={`truncate flex-1 ${color}`}>{activity.activity_type}</span>
              </button>
            );
          })}
          {dayActivities.length > 3 && (
            <div className="text-[9px] text-gray-400 text-center">+{dayActivities.length - 3} more</div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={goToToday} className="text-xs font-semibold text-gray-700 hover:text-indigo-700 px-2 py-1">
            Today
          </button>
          <button type="button" onClick={nextMonth} className="p-1 hover:bg-gray-200 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm font-bold text-gray-800">
          {monthNames[month]} {year}
        </div>
      </div>
      <div className="grid grid-cols-7 bg-gray-200 border-b border-gray-200">
        {dayNames.map(day => (
          <div key={day} className="h-8 flex items-center justify-center text-xs font-semibold text-gray-600 bg-gray-100">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days}
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function FirmActivityLogTab({ firmId, firmName, onFirmClick, onContactClick }) {
  const [activeSection, setActiveSection] = useState("activities");
  const [viewMode, setViewMode] = useState("list"); // "list" | "calendar"
  // "idle" | "picking-for-activity" | "picking-for-task" | "activity-form" | "task-form"
  const [uiState, setUiState] = useState("idle");
  const [selectedContact, setSelectedContact] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [detailActivity, setDetailActivity] = useState(null);
  
  // Filters
  const [filterFirmType, setFilterFirmType] = useState("");
  const [filterFirmName, setFilterFirmName] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // "asc" | "desc"
  const [calendarMonth, setCalendarMonth] = useState(new Date());

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
    let filtered = allActivities
      .filter(a => {
        const contact = firmContacts.find(c => c.id === a.contact_id);
        const contactPrimaryFirm = contact && (contact.firm_ids || [])[0] === firmId;
        const firmMentioned = (a.associated_firms_contacts || []).some(e => e.firm_id === firmId);
        return contactPrimaryFirm || firmMentioned;
      })
      .map(a => {
        const contact = firmContacts.find(c => c.id === a.contact_id);
        return { ...a, contact_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : null };
      });

    // Filter by firm type
    if (filterFirmType) {
      filtered = filtered.filter(a => 
        (a.associated_firms_contacts || []).some(e => {
          const firm = allFirms.find(f => f.id === e.firm_id);
          const firmTypes = firm?.firm_types?.length ? firm.firm_types : firm?.firm_type ? [firm.firm_type] : [];
          return firmTypes.includes(filterFirmType);
        })
      );
    }

    // Filter by firm name
    if (filterFirmName) {
      filtered = filtered.filter(a => 
        (a.associated_firms_contacts || []).some(e => 
          e.firm_name.toLowerCase().includes(filterFirmName.toLowerCase())
        )
      );
    }

    // Filter by date range
    if (filterDateStart) {
      filtered = filtered.filter(a => a.activity_date >= filterDateStart);
    }
    if (filterDateEnd) {
      filtered = filtered.filter(a => a.activity_date <= filterDateEnd);
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.activity_date || "");
      const dateB = new Date(b.activity_date || "");
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [allActivities, firmContactIds, firmId, firmContacts, allFirms, filterFirmType, filterFirmName, filterDateStart, filterDateEnd, sortOrder]);

  const firmTasks = useMemo(() => {
    return allTasks.filter(t =>
      t.originator_firm_id === firmId ||
      t.assigned_to_firm_id === firmId ||
      (t.assigned_firms_contacts || []).some(e => e.firm_id === firmId)
    );
  }, [allTasks, firmId]);

  const handlePickContact = (contact) => {
    setSelectedContact(contact);
    if (uiState === "picking-for-activity") setUiState("activity-form");
    else if (uiState === "picking-for-task") setUiState("task-form");
  };

  const handleFormSaved = () => { setUiState("idle"); setSelectedContact(null); };
  const handleCancel = () => { setUiState("idle"); setSelectedContact(null); };

  const isLoading = loadingActivities || loadingTasks || loadingContacts;
  const showingPicker = uiState === "picking-for-activity" || uiState === "picking-for-task";

  const sections = [
    { key: "activities", label: "Activity Logs", count: firmActivities.length },
    { key: "tasks", label: "Follow-up Tasks", count: firmTasks.length },
  ];

  return (
    <div className="space-y-3">
      {/* Section toggle + action buttons */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg flex-1">
            {sections.map(s => (
              <button key={s.key} type="button" onClick={() => setActiveSection(s.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeSection === s.key ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {s.label}
                {s.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeSection === s.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500"}`}>{s.count}</span>
                )}
              </button>
            ))}
          </div>
          {uiState === "idle" && (
            <>
              <Button type="button" variant="ghost" size="sm"
                className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs flex-shrink-0"
                onClick={() => { setActiveSection("activities"); setUiState("picking-for-activity"); }}>
                <Plus className="w-3.5 h-3.5" /> Log Activity
              </Button>
              <Button type="button" variant="ghost" size="sm"
                className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1 text-xs flex-shrink-0"
                onClick={() => { setActiveSection("tasks"); setUiState("picking-for-task"); }}>
                <Plus className="w-3.5 h-3.5" /> Add Task
              </Button>
            </>
          )}
        </div>

        {/* Filters for activities */}
        {activeSection === "activities" && (
          <div className="flex flex-wrap gap-2 items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-2 py-1 text-xs rounded ${viewMode === "list" ? "bg-white shadow text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-2 py-1 text-xs rounded ${viewMode === "calendar" ? "bg-white shadow text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}
              >
                Calendar
              </button>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <select
              value={filterFirmType}
              onChange={(e) => setFilterFirmType(e.target.value)}
              className="h-7 px-2 text-xs rounded border border-gray-300 bg-white"
            >
              <option value="">All Firm Types</option>
              {["Allocator", "Investment Consultant", "Investment Manager", "Manager of Managers", "Securities Brokerage", "Trade Organizations"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <Input
              placeholder="Filter by firm name..."
              value={filterFirmName}
              onChange={(e) => setFilterFirmName(e.target.value)}
              className="h-7 text-xs w-40"
            />
            <Input
              type="date"
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              className="h-7 text-xs w-32"
              placeholder="Start date"
            />
            <Input
              type="date"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              className="h-7 text-xs w-32"
              placeholder="End date"
            />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="h-7 px-2 text-xs rounded border border-gray-300 bg-white"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
            {(filterFirmType || filterFirmName || filterDateStart || filterDateEnd) && (
              <button
                type="button"
                onClick={() => {
                  setFilterFirmType("");
                  setFilterFirmName("");
                  setFilterDateStart("");
                  setFilterDateEnd("");
                  setSortOrder("desc");
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contact picker modal */}
      {showingPicker && (
        <ContactPickerModal firmId={firmId} firmName={firmName}
          firmContacts={firmContacts.filter(c => !c.deleted_at)}
          onPick={handlePickContact} onClose={handleCancel} />
      )}

      {/* Inline forms */}
      {uiState === "activity-form" && selectedContact && (
        <FirmActivityForm firmId={firmId} firmName={firmName} contact={selectedContact}
          allFirms={allFirms} allContacts={allContacts} onSaved={handleFormSaved} onCancel={handleCancel}
          onFirmClick={onFirmClick} onContactClick={onContactClick} />
      )}
      {uiState === "task-form" && selectedContact && (
        <FirmTaskForm firmId={firmId} firmName={firmName} contact={selectedContact}
          allFirms={allFirms} allContacts={allContacts} allActivities={firmActivities}
          onSaved={handleFormSaved} onCancel={handleCancel} />
      )}

      {isLoading ? (
        <div className="text-xs text-gray-400 italic py-6 text-center">Loading...</div>
      ) : activeSection === "activities" ? (
        firmActivities.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">No activity logs for this firm yet</div>
        ) : viewMode === "calendar" ? (
          <ActivityCalendarView
            activities={firmActivities}
            currentMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            onOpenActivity={setDetailActivity}
          />
        ) : (
          <div className="space-y-2">{firmActivities.map(a => <ActivityRow key={a.id} activity={a} onOpen={setDetailActivity} />)}</div>
        )
      ) : (
        firmTasks.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">No follow-up tasks associated with this firm yet</div>
        ) : (
          <div className="space-y-2">{firmTasks.map(t => <TaskRow key={t.id} task={t} onOpenDetail={setDetailTask} />)}</div>
        )
      )}

      <TaskDetailModal
        open={!!detailTask}
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onFirmClick={onFirmClick}
        onContactClick={onContactClick}
      />
      <ActivityDetailModal
        open={!!detailActivity}
        activity={detailActivity}
        onClose={() => setDetailActivity(null)}
        onDeleted={() => setDetailActivity(null)}
        onOpenContact={(contact, cb) => {}}
        onFirmClick={onFirmClick}
        onContactClick={onContactClick}
      />
    </div>
  );
}