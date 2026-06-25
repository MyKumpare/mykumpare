import React, { useState, useMemo, useRef, useEffect } from "react";
import ActivityDetailModal from "@/components/activity/ActivityDetailModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  X, LayoutList, Calendar, User, Building2, Clock, AlertCircle, CheckCircle2, XCircle,
  Paperclip, Link2, FileText, Edit2, Check, Plus, ChevronDown, ChevronUp, UserPlus, Trash2, Upload
} from "lucide-react";
import { format } from "date-fns";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];
const FIRM_TYPES_ORDER = ["Allocator", "Investment Consultant", "Investment Manager", "Manager of Managers", "Securities Brokerage", "Trade Organizations"];

const STATUS_STYLES = {
  "Not Started": { color: "text-gray-500",  bg: "bg-gray-100",  border: "border-gray-200",  icon: Clock },
  "In-process":  { color: "text-blue-600",  bg: "bg-blue-50",   border: "border-blue-200",  icon: AlertCircle },
  "Completed":   { color: "text-green-600", bg: "bg-green-50",  border: "border-green-200", icon: CheckCircle2 },
  "Cancelled":   { color: "text-red-500",   bg: "bg-red-50",    border: "border-red-200",   icon: XCircle },
};

// Compute aggregate status from individual assignments
function computeAggregateStatus(assignedFirmsContacts) {
  if (!assignedFirmsContacts || assignedFirmsContacts.length === 0) return "Not Started";
  
  const allStatuses = [];
  assignedFirmsContacts.forEach(entry => {
    (entry.contacts || []).forEach(c => {
      if (c.status) allStatuses.push(c.status);
    });
  });
  
  if (allStatuses.length === 0) return "Not Started";
  if (allStatuses.every(s => s === "Completed")) return "Completed";
  if (allStatuses.every(s => s === "Cancelled")) return "Cancelled";
  if (allStatuses.some(s => s === "In-process")) return "In-process";
  return "Not Started";
}

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

function todayStr() { return new Date().toISOString().split("T")[0]; }

// ── Searchable firm picker dropdown ──────────────────────────────────────────
function FirmPickerDropdown({ availableFirms, onSelect, onAddNew, placeholder = "+ Add a firm..." }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedTypes, setExpandedTypes] = useState({});
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isSearching = search.trim().length > 0;
  const filtered = availableFirms.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = {};
  FIRM_TYPES_ORDER.forEach(t => { grouped[t] = []; });
  filtered.forEach(f => {
    const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : ["Other"];
    types.forEach(t => { if (!grouped[t]) grouped[t] = []; grouped[t].push(f); });
  });
  Object.keys(grouped).forEach(t => grouped[t].sort((a, b) => a.name.localeCompare(b.name)));
  const activeTypes = Object.keys(grouped).filter(t => grouped[t].length > 0);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 h-7 px-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors bg-white">
        <Plus className="w-3 h-3" /> {placeholder}
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
      {open && (
        <div className="absolute z-[70] left-0 right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search firms..." className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {activeTypes.length === 0 && (
              <div className="px-3 py-3 space-y-1">
                <p className="text-xs text-gray-400 italic text-center">No firms found</p>
                {onAddNew && (
                  <button type="button" onClick={() => { setOpen(false); onAddNew(); }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Plus className="w-3 h-3" /> Add new firm
                  </button>
                )}
              </div>
            )}
            {activeTypes.map(type => (
              <div key={type}>
                <button type="button" onClick={() => setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hover:bg-gray-50">
                  <span>{type}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{grouped[type].length}</span>
                    {(isSearching || expandedTypes[type]) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </button>
                {(isSearching || expandedTypes[type]) && grouped[type].map(f => (
                  <button key={f.id} type="button" onClick={() => { onSelect(f); setOpen(false); setSearch(""); }}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left">
                    <Building2 className="w-3 h-3 text-indigo-400 flex-shrink-0" /> {f.name}
                  </button>
                ))}
              </div>
            ))}
            {onAddNew && activeTypes.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100">
                <button type="button" onClick={() => { setOpen(false); onAddNew(); }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <Plus className="w-3 h-3" /> Add new firm not in list
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Assignee firm+contacts editor ─────────────────────────────────────────────
function AssigneeFirmsEditor({ value = [], onChange, allFirms, allContacts }) {
  const queryClient = useQueryClient();
  const [addingNewFirm, setAddingNewFirm] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [savingFirm, setSavingFirm] = useState(false);
  const [addingContactForFirm, setAddingContactForFirm] = useState(null);

  const usedFirmIds = value.map(e => e.firm_id);
  const availableFirms = allFirms.filter(f => !f.deleted_at && !usedFirmIds.includes(f.id));

  const handleAddFirm = (firm) => {
    if (value.find(e => e.firm_id === firm.id)) return;
    onChange([...value, { firm_id: firm.id, firm_name: firm.name, contacts: [] }]);
  };

  const handleCreateFirm = async () => {
    if (!newFirmName.trim()) return;
    setSavingFirm(true);
    const created = await base44.entities.Firm.create({ name: newFirmName.trim() });
    queryClient.invalidateQueries({ queryKey: ["all_firms_for_activities"] });
    onChange([...value, { firm_id: created.id, firm_name: created.name, contacts: [] }]);
    setAddingNewFirm(false); setNewFirmName(""); setSavingFirm(false);
  };

  const handleAddContact = (firmId, contact) => {
    onChange(value.map(e => {
      if (e.firm_id !== firmId) return e;
      if (e.contacts.find(c => c.contact_id === contact.id)) return e;
      return { ...e, contacts: [...e.contacts, { contact_id: contact.id, contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") }] };
    }));
  };

  const handleRemoveContact = (firmId, contactId) => {
    onChange(value.map(e => e.firm_id !== firmId ? e : { ...e, contacts: e.contacts.filter(c => c.contact_id !== contactId) }));
  };

  const handleRemoveFirm = (firmId) => onChange(value.filter(e => e.firm_id !== firmId));

  return (
    <div className="space-y-2">
      {value.map(entry => {
        const firmAllContacts = allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(entry.firm_id));
        const availableContacts = firmAllContacts.filter(c => !entry.contacts.find(ec => ec.contact_id === c.id));
        const isAddingContact = addingContactForFirm === entry.firm_id;

        return (
          <div key={entry.firm_id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {entry.firm_name}
              </div>
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

            {availableContacts.length > 0 && (
              <Select onValueChange={(cid) => { const c = allContacts.find(x => x.id === cid); if (c) handleAddContact(entry.firm_id, c); }}>
                <SelectTrigger className="h-7 text-xs border-dashed border-gray-300 text-gray-500">
                  <SelectValue placeholder="+ Add contact from this firm..." />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ")}{c.title ? ` · ${c.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {firmAllContacts.length === 0 && !isAddingContact && (
              <p className="text-[10px] text-gray-400 italic">No contacts on file for this firm.</p>
            )}

            {isAddingContact ? (
              <InlineNewContactForm firmId={entry.firm_id}
                onCreated={(created) => { handleAddContact(entry.firm_id, created); setAddingContactForFirm(null); }}
                onCancel={() => setAddingContactForFirm(null)} />
            ) : (
              <button type="button" onClick={() => setAddingContactForFirm(entry.firm_id)}
                className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-indigo-200 text-[10px] text-indigo-500 hover:bg-indigo-50 transition-colors">
                <UserPlus className="w-3 h-3" /> Add new contact for this firm
              </button>
            )}
          </div>
        );
      })}

      {!addingNewFirm ? (
        <FirmPickerDropdown availableFirms={availableFirms} onSelect={handleAddFirm} onAddNew={() => setAddingNewFirm(true)} />
      ) : (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-2.5 space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">New Firm</p>
          <Input value={newFirmName} onChange={e => setNewFirmName(e.target.value)} className="h-7 text-xs" placeholder="Firm name *" autoFocus />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => { setAddingNewFirm(false); setNewFirmName(""); }}>Cancel</Button>
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
    queryClient.invalidateQueries({ queryKey: ["all_contacts_for_tasks"] });
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
          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
            <FileText className="w-3 h-3" />
          </a>
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

// ── View-mode attachments with quick-add ─────────────────────────────────────
function ViewModeAttachments({ task, onAttachmentsUpdated }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const current = task.attachments || [];
    const results = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      results.push({ id: crypto.randomUUID(), name: file.name, file_url, file_type: file.type, uploaded_at: new Date().toISOString() });
    }
    onAttachmentsUpdated([...current, ...results]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const atts = task.attachments || [];

  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        <Paperclip className="w-3 h-3" /> Attachments
      </p>
      <div className="space-y-1">
        {atts.map(att => (
          <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
            <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{att.name}</span>
          </a>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
          <Upload className="w-3 h-3" /> {uploading ? "Uploading..." : "Attach file(s)"}
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}

// ── Individual assignee status editor ─────────────────────────────────────────
function AssigneeStatusEditor({ assignedFirmsContacts, onChange, allContacts }) {
  const handleStatusChange = (firmId, contactId, newStatus) => {
    const today = todayStr();
    onChange(assignedFirmsContacts.map(entry => {
      if (entry.firm_id !== firmId) return entry;
      return {
        ...entry,
        contacts: (entry.contacts || []).map(c => {
          if (c.contact_id !== contactId) return c;
          return {
            ...c,
            status: newStatus,
            status_date: newStatus !== c.status ? today : c.status_date,
          };
        }),
      };
    }));
  };

  return (
    <div className="space-y-3">
      {assignedFirmsContacts.map((entry, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {entry.firm_name}
          </div>
          {entry.contacts?.length > 0 && (
            <div className="space-y-2">
              {entry.contacts.map(c => {
                const contactStatus = c.status || "Not Started";
                const s = STATUS_STYLES[contactStatus] || STATUS_STYLES["Not Started"];
                const StatusIcon = s.icon;
                const contact = allContacts.find(x => x.id === c.contact_id);

                return (
                  <div key={c.contact_id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                      <StatusIcon className={`w-3 h-3 ${s.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{c.contact_name}</p>
                      {contact?.title && <p className="text-[10px] text-gray-400 truncate">{contact.title}</p>}
                    </div>
                    <Select value={contactStatus} onValueChange={(v) => handleStatusChange(entry.firm_id, c.contact_id, v)}>
                      <SelectTrigger className="h-7 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Helper: derive primary assignee from assigned_firms_contacts ──────────────
function getPrimaryAssignee(task) {
  const fc = task.assigned_firms_contacts;
  if (fc?.length) {
    for (const entry of fc) {
      if (entry.contacts?.length) {
        return { name: entry.contacts[0].contact_name, firm: entry.firm_name };
      }
    }
  }
  if (task.assigned_to_contact_name) return { name: task.assigned_to_contact_name, firm: task.assigned_to_firm_name };
  return null;
}

// ── Individual assignment status card ─────────────────────────────────────────
function AssignmentCard({ entry, allContacts, allFirms, onContactClick, onFirmClick }) {
  const contacts = entry.contacts || [];
  
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <button
        type="button"
        onClick={() => onFirmClick && onFirmClick(allFirms.find(f => f.id === entry.firm_id))}
        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition-colors"
      >
        <Building2 className="w-3.5 h-3.5" /> {entry.firm_name}
      </button>
      {contacts.length > 0 && (
        <div className="space-y-1.5">
          {contacts.map(c => {
            const cStatus = c.status || "Not Started";
            const cStyle = STATUS_STYLES[cStatus] || STATUS_STYLES["Not Started"];
            const CIcon = cStyle.icon;
            const contact = allContacts.find(x => x.id === c.contact_id);
            
            return (
              <div key={c.contact_id} className="rounded-lg bg-white border border-indigo-100 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onContactClick && onContactClick(contact)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-indigo-700 transition-colors"
                  >
                    <User className="w-3 h-3 text-indigo-400" /> {c.contact_name}
                  </button>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cStyle.bg} ${cStyle.color}`}>
                    <CIcon className="w-2.5 h-2.5" /> {cStatus}
                  </span>
                </div>
                {c.status_date && (
                  <p className="text-[10px] text-gray-400">Status updated {fmt(c.status_date)}</p>
                )}
                {c.notes && (
                  <div className="quill-preview text-xs text-gray-600" dangerouslySetInnerHTML={{ __html: c.notes }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function TaskDetailModal({ open, task: initialTask, onClose, onTaskClick, onFirmClick, onContactClick }) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [taskDescription, setTaskDescription] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [status, setStatus] = useState("Not Started");
  const [statusDate, setStatusDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Local live task state (refreshed from query)
  const { data: task } = useQuery({
    queryKey: ["task_detail", initialTask?.id],
    queryFn: () => base44.entities.FollowUpTask.get ? base44.entities.FollowUpTask.filter({ id: initialTask.id }).then(r => r[0]) : Promise.resolve(initialTask),
    initialData: initialTask,
    enabled: open && !!initialTask?.id,
    refetchInterval: open ? 10000 : false,
  });

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

  // Sync local state with task data when entering edit mode
  useEffect(() => {
    if (task && editMode) {
      setEditStatus(task.status || "Not Started");
      setEditStatusDate(task.status_date || "");
      setEditDueDate(task.due_date || "");
      setEditDesc(task.task_description || "");
      setEditNotes(task.notes || "");
      setEditAssignedFirms(task.assigned_firms_contacts || (task.assigned_to_firm_id ? [{ firm_id: task.assigned_to_firm_id, firm_name: task.assigned_to_firm_name, contacts: task.assigned_to_contact_id ? [{ contact_id: task.assigned_to_contact_id, contact_name: task.assigned_to_contact_name }] : [] }] : []));
      setEditAttachments(task.attachments || []);
    }
  }, [editMode, task?.id, task]);

  // Linked activity modal state
  const [linkedActivity, setLinkedActivity] = useState(null);
  const [linkedActivityModalOpen, setLinkedActivityModalOpen] = useState(false);

  const { data: linkedActivityData } = useQuery({
    queryKey: ["linked_activity", task?.activity_id],
    queryFn: () => base44.entities.ContactActivity.filter({ id: task.activity_id }).then(r => r[0]),
    enabled: open && !!task?.activity_id,
  });

  // Edit state
  const [editStatus, setEditStatus] = useState("");
  const [editStatusDate, setEditStatusDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAssignedFirms, setEditAssignedFirms] = useState([]);
  const [editAttachments, setEditAttachments] = useState([]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.FollowUpTask.update(task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task_detail", task.id] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", task.originator_contact_id] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", task.assigned_to_contact_id] });
      queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", task.originator_firm_id] });
      queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", task.assigned_to_firm_id] });
      // Invalidate for all assigned firms
      (task.assigned_firms_contacts || []).forEach(e => {
        queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", e.firm_id] });
        (e.contacts || []).forEach(c => queryClient.invalidateQueries({ queryKey: ["follow_up_tasks_assigned", c.contact_id] }));
      });
      setEditMode(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.FollowUpTask.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks", task.originator_contact_id] });
      queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm", task.originator_firm_id] });
      onClose();
    },
  });

  const handleSave = () => {
    const today = todayStr();
    // Compute aggregate status from individual assignments
    const aggregateStatus = computeAggregateStatus(editAssignedFirms);
    const statusChanged = aggregateStatus !== task.status;
    
    // Derive primary assignee from assigned_firms_contacts
    let primaryContact = null;
    let primaryFirm = null;
    for (const entry of editAssignedFirms) {
      if (entry.contacts?.length) {
        primaryContact = entry.contacts[0];
        primaryFirm = entry;
        break;
      }
    }
    const data = {
      status: aggregateStatus,
      due_date: editDueDate,
      task_description: editDesc,
      notes: editNotes,
      assigned_firms_contacts: editAssignedFirms,
      assigned_to_contact_id: primaryContact?.contact_id || undefined,
      assigned_to_contact_name: primaryContact?.contact_name || undefined,
      assigned_to_firm_id: primaryFirm?.firm_id || undefined,
      assigned_to_firm_name: primaryFirm?.firm_name || undefined,
      attachments: editAttachments.length ? editAttachments : undefined,
      // Use the user-edited status date; if status changed and no date set, default to today
      status_date: editStatusDate || (statusChanged ? today : task.status_date) || undefined,
    };
    if (aggregateStatus === "Completed" && !task.completion_date) {
      data.completion_date = today;
    }
    updateMutation.mutate(data);
  };

  if (!open || !task) return null;

  const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
  const StatusIcon = s.icon;
  const primaryAssignee = getPrimaryAssignee(task);
  const assignedFirmsContacts = task.assigned_firms_contacts || (task.assigned_to_firm_id ? [{ firm_id: task.assigned_to_firm_id, firm_name: task.assigned_to_firm_name, contacts: task.assigned_to_contact_id ? [{ contact_id: task.assigned_to_contact_id, contact_name: task.assigned_to_contact_name }] : [] }] : []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-orange-600" />
            Follow-up Task
          </h2>
          <div className="flex items-center gap-2">
            {!editMode && (
              <button type="button" onClick={() => setEditMode(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!editMode ? (
            <>
              {/* Status + dates */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                  <StatusIcon className="w-3 h-3" /> {task.status}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Due {fmt(task.due_date)}
                </span>
                {task.status_date && (
                  <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                    Status updated {fmt(task.status_date)}
                  </span>
                )}
                {task.completion_date && (
                  <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Completed {fmt(task.completion_date)}
                  </span>
                )}
              </div>

              {/* Task Description */}
              {task.task_description && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Task Description</p>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed quill-preview"
                    dangerouslySetInnerHTML={{ __html: task.task_description }} />
                </div>
              )}

              {/* Originator */}
              {task.originator_contact_name && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Requested By</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                      {(task.originator_contact_name || "?")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{task.originator_contact_name}</p>
                      {task.originator_firm_name && <p className="text-[10px] text-gray-400">{task.originator_firm_name}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Assigned firms/contacts with individual statuses */}
              {assignedFirmsContacts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Assigned To</p>
                  <div className="space-y-2">
                    {assignedFirmsContacts.map((entry, i) => (
                      <AssignmentCard
                        key={i}
                        entry={entry}
                        allContacts={allContacts}
                        allFirms={allFirms}
                        onContactClick={onContactClick}
                        onFirmClick={onFirmClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {task.notes && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</p>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed quill-preview"
                    dangerouslySetInnerHTML={{ __html: task.notes }} />
                </div>
              )}

              {/* Linked Activity */}
              {task.activity_label && (
                <button
                  type="button"
                  onClick={() => { if (linkedActivityData) { setLinkedActivity(linkedActivityData); setLinkedActivityModalOpen(true); } }}
                  className={`w-full flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl text-left transition-colors ${linkedActivityData ? "hover:bg-indigo-100 cursor-pointer" : "cursor-default"}`}
                >
                  <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate flex-1">Linked to: {task.activity_label}</span>
                  {linkedActivityData && <span className="text-[10px] text-indigo-400 flex-shrink-0">View →</span>}
                </button>
              )}

              {/* Attachments (view mode with quick-add) */}
              <ViewModeAttachments task={task} onAttachmentsUpdated={(atts) => updateMutation.mutate({ attachments: atts })} />

              <div className="flex justify-end">
                <button type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3 h-3" /> Delete Task
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Edit form */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">Status</Label>
                  <Select value={editStatus} onValueChange={(v) => {
                    setEditStatus(v);
                    // Auto-set status date to today when status changes
                    if (v !== task.status) setEditStatusDate(todayStr());
                  }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">Due Date</Label>
                  <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Status Date <span className="text-gray-400 font-normal">(auto-set on status change, editable)</span></Label>
                <Input type="date" value={editStatusDate} onChange={e => setEditStatusDate(e.target.value)} className="h-8 text-sm" placeholder="Leave blank if not applicable" />
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
                  <ReactQuill theme="snow" value={editNotes} onChange={setEditNotes} modules={QUILL_MODULES} placeholder="Add notes or updates..." style={{ minHeight: 80 }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <User className="w-3 h-3 text-indigo-500" /> Assignees & Status
                </Label>
                <AssigneeFirmsEditor value={editAssignedFirms} onChange={setEditAssignedFirms} allFirms={allFirms} allContacts={allContacts} />
                <div className="pt-2">
                  <Label className="text-xs font-medium text-gray-700 mb-2 block">Individual Status Updates</Label>
                  <AssigneeStatusEditor
                    assignedFirmsContacts={editAssignedFirms}
                    onChange={setEditAssignedFirms}
                    allContacts={allContacts}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Paperclip className="w-3 h-3 text-gray-400" /> Attachments
                </Label>
                <AttachmentsManager attachments={editAttachments} onChange={setEditAttachments} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
          {editMode ? (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button type="button" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleSave} disabled={updateMutation.isPending}>
                <Check className="w-3 h-3 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <button type="button" onClick={onClose}
              className="w-full h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Close
            </button>
          )}
        </div>
      </div>

      {linkedActivityModalOpen && linkedActivity && (
        <ActivityDetailModal
          open={linkedActivityModalOpen}
          activity={linkedActivity}
          onClose={() => { setLinkedActivityModalOpen(false); setLinkedActivity(null); }}
        />
      )}
    </div>
  );
}