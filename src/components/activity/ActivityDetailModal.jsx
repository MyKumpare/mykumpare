import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, ClipboardList, Calendar, Tag, Building2, User, FileText, Trash2, ExternalLink, Pencil, Plus, ChevronDown, ChevronUp, UserPlus, ChevronRight, Paperclip, Upload } from "lucide-react";
import TaskAssigneeEditor from "@/components/activity/TaskAssigneeEditor";
import { format } from "date-fns";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import TaskDetailModal from "@/components/activity/TaskDetailModal";
import OriginatorPicker from "@/components/activity/OriginatorPicker";

const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];

const ACTIVITY_TYPE_COLORS = {
  Call: "bg-blue-50 text-blue-700 border-blue-200",
  Email: "bg-purple-50 text-purple-700 border-purple-200",
  Meeting: "bg-green-50 text-green-700 border-green-200",
  Note: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Other: "bg-gray-50 text-gray-600 border-gray-200",
};

const ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Note", "Other"];

const QUILL_MODULES = {
  toolbar: [
    [{ header: [false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "clean"],
  ],
};

const FIRM_TYPES_ORDER = [
  "Allocator", "Investment Consultant", "Investment Manager",
  "Manager of Managers", "Securities Brokerage", "Trade Organizations",
];

const TASK_STATUS_COLORS = {
  "Not Started": "bg-gray-100 text-gray-600",
  "In-process": "bg-blue-50 text-blue-700",
  "Completed": "bg-green-50 text-green-700",
  "Cancelled": "bg-red-50 text-red-600",
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMMM d, yyyy"); } catch { return dateStr; }
}

// ── Searchable firm picker dropdown ──────────────────────────────────────────
function FirmPickerDropdown({ availableFirms, onSelect, onAddNew }) {
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
  const activeTypes = Object.keys(grouped).filter(t => grouped[t].length > 0);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 h-7 px-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors bg-white">
        <Plus className="w-3 h-3" /> + Add a firm...
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search firms..." className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {activeTypes.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-3">No firms found</p>
            )}
            {activeTypes.map(type => (
              <div key={type}>
                <button type="button" onClick={() => setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hover:bg-gray-50">
                  <span>{type}</span>
                  {(isSearching || expandedTypes[type]) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {(isSearching || expandedTypes[type]) && grouped[type].map(f => (
                  <button key={f.id} type="button" onClick={() => { onSelect(f); setOpen(false); setSearch(""); }}
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left">
                    <Building2 className="w-3 h-3 text-indigo-400 flex-shrink-0" /> {f.name}
                  </button>
                ))}
              </div>
            ))}
            {onAddNew && (
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

// ── Firm entry with inline contact picker ─────────────────────────────────────
function FirmEntry({ entry, allContacts, onChange, onRemove }) {
  const [addingContact, setAddingContact] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const allFirmContacts = allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(entry.firm_id));

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

  const filteredContacts = allFirmContacts.filter(c =>
    !contactSearch || [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-indigo-500" /> {entry.firm_name}
        </span>
        <button type="button" onClick={onRemove} className="text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
      </div>

      {allFirmContacts.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Who was involved?</p>
          {allFirmContacts.length > 4 && (
            <input type="text" value={contactSearch} onChange={e => setContactSearch(e.target.value)}
              placeholder="Search contacts..." className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50" />
          )}
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filteredContacts.map(c => {
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
                  <div>
                    <p className="text-xs font-medium text-gray-800">{[c.first_name, c.last_name].filter(Boolean).join(" ")}</p>
                    {c.title && <p className="text-[10px] text-gray-400">{c.title}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {allFirmContacts.length === 0 && !addingContact && (
        <p className="text-xs text-gray-400 italic px-1">No contacts on file for this firm.</p>
      )}

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
function AssociatedFirmsEditor({ value = [], onChange, allFirms }) {
  const queryClient = useQueryClient();
  const { data: allContacts = [] } = useQuery({
    queryKey: ["all_contacts_for_activities"],
    queryFn: () => base44.entities.Contact.list(),
  });
  const [addingFirm, setAddingFirm] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [savingFirm, setSavingFirm] = useState(false);

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
    setAddingFirm(false); setNewFirmName("");
    setSavingFirm(false);
  };

  const usedFirmIds = value.map(e => e.firm_id);
  const availableFirms = allFirms.filter(f => !f.deleted_at && !usedFirmIds.includes(f.id));

  return (
    <div className="space-y-2">
      {value.map((entry) => (
        <FirmEntry key={entry.firm_id} entry={entry} allContacts={allContacts}
          onChange={(updated) => onChange(value.map(e => e.firm_id === entry.firm_id ? updated : e))}
          onRemove={() => onChange(value.filter(e => e.firm_id !== entry.firm_id))} />
      ))}
      {!addingFirm && (
        <FirmPickerDropdown availableFirms={availableFirms} onSelect={handleAddFirm} onAddNew={() => setAddingFirm(true)} />
      )}
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

// ── File type picker with search and create ───────────────────────────────────
const COMMON_FILE_TYPES = [
  "Document", "Spreadsheet", "Presentation", "PDF", "Image", "Photo", "Video", "Audio",
  "Contract", "Agreement", "Invoice", "Receipt", "Report", "Memo", "Email", "Note",
  "Marketing Material", "Brochure", "Fact Sheet", "Pitch Deck", "Due Diligence",
  "Financial Statement", "Tax Document", "Legal Document", "Compliance", "Certificate",
  "Meeting Notes", "Call Notes", "Presentation Slides", "Data File", "Archive", "Other"
];

function FileTypePicker({ value, onChange, onClose }) {
  const [search, setSearch] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newType, setNewType] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = COMMON_FILE_TYPES.filter(t =>
    !search || t.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (type) => {
    onChange(type);
    onClose();
  };

  const handleCreate = () => {
    if (!newType.trim()) return;
    onChange(newType.trim());
    setCreatingNew(false);
    setNewType("");
    onClose();
  };

  return (
    <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" ref={ref}>
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus={!creatingNew}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search file types..."
          className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 && !creatingNew && (
          <div className="px-3 py-3">
            <p className="text-xs text-gray-400 italic text-center mb-2">No matching types</p>
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-3 h-3" /> Create "{search}"
            </button>
          </div>
        )}
        {!creatingNew && filtered.map(type => (
          <button
            key={type}
            type="button"
            onClick={() => handleSelect(type)}
            className="w-full flex items-center px-3 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
          >
            {type}
          </button>
        ))}
        {creatingNew && (
          <div className="p-2 space-y-2">
            <input
              autoFocus
              type="text"
              value={newType}
              onChange={e => setNewType(e.target.value)}
              placeholder="Enter file type..."
              className="w-full h-7 px-2.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-indigo-400"
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setCreatingNew(false); setNewType(""); }}
                className="flex-1 h-7 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newType.trim()}
                className="flex-1 h-7 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        )}
        {!creatingNew && (
          <div className="px-3 py-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-3 h-3" /> Create new file type
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Attachments manager (reusable for activity) ───────────────────────────────
function ActivityAttachmentsManager({ attachments = [], onChange, readOnly = false, onDirectSave }) {
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showTypePicker, setShowTypePicker] = useState(null);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const pending = files.map(f => ({
      file: f,
      id: crypto.randomUUID(),
      name: f.name,
      file_url: null,
      file_type: null,
      uploaded_at: null
    }));
    setPendingFiles(prev => [...prev, ...pending]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSetType = async (pendingId, fileType) => {
    const pending = pendingFiles.find(p => p.id === pendingId);
    if (!pending) return;
    
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: pending.file });
    const result = {
      id: pending.id,
      name: pending.name,
      file_url,
      file_type: fileType,
      uploaded_at: new Date().toISOString()
    };
    
    const updated = attachments.filter(a => !pendingFiles.find(p => p.id === a.id));
    const final = [...updated, result];
    
    if (onDirectSave) {
      onDirectSave(final);
    } else {
      onChange(final);
    }
    
    setPendingFiles(prev => prev.filter(p => p.id !== pendingId));
    setUploading(false);
  };

  const handleRemovePending = (pendingId) => {
    setPendingFiles(prev => prev.filter(p => p.id !== pendingId));
  };

  if (readOnly) {
    return (
      <div className="space-y-1">
        {attachments.map(att => (
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
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5 relative">
      {/* Pending files awaiting type selection */}
      {pendingFiles.map(pending => (
        <div key={pending.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs">
          <Paperclip className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <span className="flex-1 truncate text-gray-700">{pending.name}</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTypePicker(showTypePicker === pending.id ? null : pending.id)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-amber-200 text-amber-700 hover:bg-amber-100"
            >
              <Tag className="w-3 h-3" />
              <span className="text-[10px]">Select Type</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showTypePicker === pending.id && (
              <FileTypePicker
                value=""
                onChange={(type) => handleSetType(pending.id, type)}
                onClose={() => setShowTypePicker(null)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => handleRemovePending(pending.id)}
            className="text-amber-400 hover:text-red-500 flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      
      {/* Uploaded attachments */}
      {attachments.filter(att => att.file_url).map(att => (
        <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs">
          <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <input
            className="flex-1 bg-transparent outline-none text-gray-700 min-w-0"
            value={att.name}
            onChange={e => onChange(attachments.map(a => a.id === att.id ? { ...a, name: e.target.value } : a))}
          />
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{att.file_type}</span>
          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
            <FileText className="w-3 h-3" />
          </a>
          <button type="button" onClick={() => onChange(attachments.filter(a => a.id !== att.id))} className="text-gray-300 hover:text-red-500 flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
      >
        <Upload className="w-3 h-3" /> {uploading ? "Uploading..." : "Attach file(s)"}
      </button>
      <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function ActivityDetailModal({ open, activity, onClose, onOpenContact, onDeleted, onFirmClick, onContactClick }) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [addTask, setAddTask] = useState(false);
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [taskStatus, setTaskStatus] = useState("Not Started");
  const [taskAssignedFirms, setTaskAssignedFirms] = useState([]);
  const [taskAttachments, setTaskAttachments] = useState([]);
  const [savingTask, setSavingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [originator, setOriginator] = useState({ firmId: "", firmName: "", firmType: null, contactId: "", contactName: "" });

  useEffect(() => {
    if (activity) {
      setForm({
        activity_type: activity.activity_type || "Call",
        activity_date: activity.activity_date || "",
        subject: activity.subject || "",
        notes: activity.notes || "",
        associated_firms_contacts: activity.associated_firms_contacts || [],
        attachments: activity.attachments || [],
      });
      setEditing(false);
      setConfirmDelete(false);
      setAddTask(false);
      setTaskDesc("");
      setTaskDueDate(new Date().toISOString().split("T")[0]);
      setTaskStatus("Not Started");
      setTaskAssignedFirms([]);
      setOriginator({ firmId: "", firmName: "", firmType: null, contactId: "", contactName: "" });
    }
  }, [activity]);

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // First, delete all associated follow-up tasks
      const tasks = await base44.entities.FollowUpTask.filter({ activity_id: id });
      if (tasks && tasks.length > 0) {
        await Promise.all(tasks.map(task => base44.entities.FollowUpTask.delete(task.id)));
      }
      // Then delete the activity
      await base44.entities.ContactActivity.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities"] });
      queryClient.invalidateQueries({ queryKey: ["follow_up_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm"] });
      onClose();
      if (onDeleted) onDeleted();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ContactActivity.update(activity.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact_activities"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities_for_firm"] });
      queryClient.invalidateQueries({ queryKey: ["all_activities"] });
      setEditing(false);
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
    enabled: open && !!activity,
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list(),
    enabled: open && !!activity,
  });

  // Resolve the originator (contact + firm) from the activity's contact_id
  useEffect(() => {
    if (!activity?.contact_id || !contacts.length) return;
    const contact = contacts.find(c => c.id === activity.contact_id);
    if (!contact) return;
    const firmId = (contact.firm_ids || [])[0] || "";
    const firm = firmId ? firms.find(f => f.id === firmId) : null;
    setOriginator({
      firmId,
      firmName: firm?.name || "",
      firmType: firm ? (firm.firm_types?.length ? firm.firm_types[0] : firm.firm_type || null) : null,
      contactId: contact.id,
      contactName: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
    });
  }, [activity?.contact_id, contacts, firms]);

  const { data: linkedTasks = [] } = useQuery({
    queryKey: ["tasks_for_activity", activity?.id],
    queryFn: () => base44.entities.FollowUpTask.filter({ activity_id: activity.id }),
    enabled: open && !!activity?.id,
  });

  const handleSaveTask = async () => {
    if (!taskDesc || taskDesc === "<p><br></p>") return;
    setSavingTask(true);
    const originatorContact = contacts.find(c => c.id === activity.contact_id);
    const originatorFirmId = (originatorContact?.firm_ids || [])[0];
    const originatorFirm = originatorFirmId ? firms.find(f => f.id === originatorFirmId) : null;
    const today = new Date().toISOString().split("T")[0];
    
    // Initialize assignments array with status for each contact
    const assignments = [];
    taskAssignedFirms.forEach(entry => {
      (entry.contacts || []).forEach(c => {
        assignments.push({
          id: crypto.randomUUID(),
          contact_id: c.contact_id,
          contact_name: c.contact_name,
          firm_id: entry.firm_id,
          firm_name: entry.firm_name,
          status: taskStatus || "Not Started",
          status_date: today,
          notes: "",
        });
      });
    });
    
    let primaryContactId, primaryContactName, primaryFirmId, primaryFirmName;
    for (const entry of taskAssignedFirms) {
      if (entry.contacts?.length) {
        primaryContactId = entry.contacts[0].contact_id;
        primaryContactName = entry.contacts[0].contact_name;
        primaryFirmId = entry.firm_id;
        primaryFirmName = entry.firm_name;
        break;
      }
    }
    await base44.entities.FollowUpTask.create({
      originator_contact_id: activity.contact_id,
      originator_contact_name: originatorContact ? [originatorContact.first_name, originatorContact.last_name].filter(Boolean).join(" ") : "",
      originator_firm_id: originatorFirmId || undefined,
      originator_firm_name: originatorFirm?.name || undefined,
      activity_id: activity.id,
      activity_label: `${activity.activity_type}${activity.subject ? ` – ${activity.subject}` : ""} (${fmt(activity.activity_date)})`,
      due_date: taskDueDate,
      task_description: taskDesc,
      status: taskStatus,
      status_date: today,
      assigned_firms_contacts: taskAssignedFirms.length ? taskAssignedFirms : undefined,
      assignments: assignments.length ? assignments : undefined,
      assigned_to_contact_id: primaryContactId || undefined,
      assigned_to_contact_name: primaryContactName || undefined,
      assigned_to_firm_id: primaryFirmId || undefined,
      assigned_to_firm_name: primaryFirmName || undefined,
      attachments: taskAttachments.length ? taskAttachments : undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["follow_up_tasks"] });
    queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm"] });
    queryClient.invalidateQueries({ queryKey: ["tasks_for_activity", activity.id] });
    setAddTask(false);
    setTaskDesc("");
    setTaskDueDate(new Date().toISOString().split("T")[0]);
    setTaskStatus("Not Started");
    setTaskAssignedFirms([]);
    setTaskAttachments([]);
    setSavingTask(false);
  };

  if (!open || !activity) return null;

  const contact = contacts.find(c => c.id === activity.contact_id);
  const contactName = contact
    ? [contact.salutation, contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : "Unknown Contact";

  const colorClass = ACTIVITY_TYPE_COLORS[form.activity_type] || ACTIVITY_TYPE_COLORS.Other;

  const firmMap = {};
  firms.forEach(f => { firmMap[f.id] = f; });

  const primaryFirmId = (contact?.firm_ids || [])[0];
  const primaryFirm = primaryFirmId ? firmMap[primaryFirmId] : null;

  const handleSave = async () => {
    const payload = { ...form, contact_id: originator.contactId || activity.contact_id };
    updateMutation.mutate(payload, {
      onSuccess: async () => {
        if (addTask && taskDesc && taskDesc !== "<p><br></p>") {
          const originatorContact = contacts.find(c => c.id === (payload.contact_id || activity.contact_id));
          const originatorFirmId = (originatorContact?.firm_ids || [])[0];
          const originatorFirm = originatorFirmId ? firms.find(f => f.id === originatorFirmId) : null;
          const today = new Date().toISOString().split("T")[0];
          
          // Initialize assignments array with status for each contact
          const assignments = [];
          taskAssignedFirms.forEach(entry => {
            (entry.contacts || []).forEach(c => {
              assignments.push({
                id: crypto.randomUUID(),
                contact_id: c.contact_id,
                contact_name: c.contact_name,
                firm_id: entry.firm_id,
                firm_name: entry.firm_name,
                status: taskStatus || "Not Started",
                status_date: today,
                notes: "",
              });
            });
          });
          
          let primaryContactId, primaryContactName, primaryFirmId, primaryFirmName;
          for (const entry of taskAssignedFirms) {
            if (entry.contacts?.length) {
              primaryContactId = entry.contacts[0].contact_id;
              primaryContactName = entry.contacts[0].contact_name;
              primaryFirmId = entry.firm_id;
              primaryFirmName = entry.firm_name;
              break;
            }
          }
          await base44.entities.FollowUpTask.create({
            originator_contact_id: payload.contact_id || activity.contact_id,
            originator_contact_name: originatorContact ? [originatorContact.first_name, originatorContact.last_name].filter(Boolean).join(" ") : "",
            originator_firm_id: originatorFirmId || undefined,
            originator_firm_name: originatorFirm?.name || undefined,
            activity_id: activity.id,
            activity_label: `${form.activity_type}${form.subject ? ` – ${form.subject}` : ""} (${fmt(form.activity_date)})`,
            due_date: taskDueDate,
            task_description: taskDesc,
            status: taskStatus,
            status_date: today,
            assigned_firms_contacts: taskAssignedFirms.length ? taskAssignedFirms : undefined,
            assignments: assignments.length ? assignments : undefined,
            assigned_to_contact_id: primaryContactId || undefined,
            assigned_to_contact_name: primaryContactName || undefined,
            assigned_to_firm_id: primaryFirmId || undefined,
            assigned_to_firm_name: primaryFirmName || undefined,
            attachments: taskAttachments.length ? taskAttachments : undefined,
          });
          queryClient.invalidateQueries({ queryKey: ["follow_up_tasks"] });
          queryClient.invalidateQueries({ queryKey: ["all_tasks_for_firm"] });
          queryClient.invalidateQueries({ queryKey: ["tasks_for_activity", activity.id] });
          setAddTask(false);
          setTaskDesc("");
          setTaskDueDate(new Date().toISOString().split("T")[0]);
          setTaskStatus("Not Started");
          setTaskAttachments([]);
        }
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-600" />
              {editing ? "Edit Activity" : "Activity Detail"}
            </h2>
            <button type="button" onClick={onClose}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {editing ? (
              <>
                {/* Originator (editable) */}
                <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Originator (contact)</p>
                  <OriginatorPicker
                    allFirms={firms}
                    allContacts={contacts}
                    firmId={originator.firmId}
                    firmName={originator.firmName}
                    firmType={originator.firmType}
                    contactId={originator.contactId}
                    contactName={originator.contactName}
                    onChange={setOriginator}
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Activity Type</label>
                  <div className="flex flex-wrap gap-2">
                    {ACTIVITY_TYPES.map(t => (
                      <button key={t} type="button"
                        onClick={() => setForm(f => ({ ...f, activity_type: t }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${form.activity_type === t ? ACTIVITY_TYPE_COLORS[t] : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Date</label>
                  <input type="date" value={form.activity_date}
                    onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Subject</label>
                  <input type="text" value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Subject..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Notes</label>
                  <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <ReactQuill
                      theme="snow"
                      value={form.notes}
                      onChange={(val) => setForm(f => ({ ...f, notes: val }))}
                      modules={QUILL_MODULES}
                      placeholder="Activity details..."
                      style={{ minHeight: 100 }}
                    />
                  </div>
                </div>

                {/* Associated Firms & Contacts */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Associated Firms & Contacts
                  </label>
                  <AssociatedFirmsEditor
                    value={form.associated_firms_contacts}
                    onChange={(val) => setForm(f => ({ ...f, associated_firms_contacts: val }))}
                    allFirms={firms}
                  />
                </div>

                {/* Attachments (edit mode) */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Attachments
                  </label>
                  <ActivityAttachmentsManager
                    attachments={form.attachments || []}
                    onChange={(val) => setForm(f => ({ ...f, attachments: val }))}
                  />
                </div>

                {/* Existing linked tasks in edit mode */}
                {linkedTasks.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" /> Linked Tasks
                    </label>
                    <div className="space-y-1.5">
                      {linkedTasks.map(task => (
                        <button key={task.id} type="button" onClick={() => setSelectedTask(task)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-left">
                          <div className="text-xs text-gray-700 quill-preview flex-1 min-w-0 line-clamp-1"
                            dangerouslySetInnerHTML={{ __html: task.task_description }} />
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TASK_STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600"}`}>
                            {task.status}
                          </span>
                          <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add follow-up task */}
                {!addTask ? (
                  <button type="button" onClick={() => setAddTask(true)}
                    className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <ClipboardList className="w-3.5 h-3.5" /> Add a follow-up task for this activity
                  </button>
                ) : (
                  <div className="rounded-lg border border-indigo-200 bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" /> Follow-up Task
                      </span>
                      <button type="button" onClick={() => setAddTask(false)}>
                        <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700">Task Description *</Label>
                      <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <ReactQuill theme="snow" value={taskDesc} onChange={setTaskDesc}
                          modules={QUILL_MODULES} placeholder="Describe the task..." style={{ minHeight: 70 }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-700">Due Date</Label>
                        <Input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-700">Status</Label>
                        <Select value={taskStatus} onValueChange={setTaskStatus}>
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
                        value={taskAssignedFirms}
                        onChange={setTaskAssignedFirms}
                        allFirms={firms}
                        allContacts={contacts}
                        originatorFirmId={(contacts.find(c => c.id === activity.contact_id)?.firm_ids || [])[0]}
                        originatorFirmName={firms.find(f => f.id === (contacts.find(c => c.id === activity.contact_id)?.firm_ids || [])[0])?.name}
                      />
                    </div>
                    {taskAssignedFirms.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assigned To</p>
                        {taskAssignedFirms.map((entry, i) => (
                          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <button
                              type="button"
                              onClick={() => onFirmClick && onFirmClick(firms.find(f => f.id === entry.firm_id))}
                              className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1 hover:text-indigo-600 transition-colors"
                            >
                              <Building2 className="w-3 h-3 text-indigo-400" /> {entry.firm_name}
                            </button>
                            {entry.contacts?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pl-4">
                                {entry.contacts.map((c, j) => (
                                  <button
                                    key={j}
                                    type="button"
                                    onClick={() => onContactClick && onContactClick(contacts.find(x => x.id === c.contact_id))}
                                    className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                                  >
                                    <User className="w-2.5 h-2.5" /> {c.contact_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <Paperclip className="w-3 h-3 text-gray-400" /> Attachments
                      </Label>
                      <ActivityAttachmentsManager attachments={taskAttachments} onChange={setTaskAttachments} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Type + Date */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>
                    <Tag className="w-3 h-3" />
                    {activity.activity_type}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {fmt(activity.activity_date)}
                  </span>
                </div>

                {/* Subject */}
                {activity.subject && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Subject</p>
                    <p className="text-base font-semibold text-gray-800">{activity.subject}</p>
                  </div>
                )}

                {/* Contact + Firm */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Originator</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                      {(contact?.first_name || "?")[0]}{(contact?.last_name || "")[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{contactName}</p>
                      {contact?.title && <p className="text-xs text-gray-400 truncate">{contact.title}</p>}
                    </div>
                    {onOpenContact && contact && (
                      <button
                        type="button"
                        onClick={() => onOpenContact(contact, () => {})}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap"
                      >
                        <ExternalLink className="w-3 h-3" /> View Contact
                      </button>
                    )}
                  </div>
                  {primaryFirm && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 pl-10">
                      <Building2 className="w-3 h-3 text-indigo-400" />
                      {primaryFirm.name}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {activity.notes && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Notes
                    </p>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="text-sm text-gray-700 leading-relaxed quill-preview" dangerouslySetInnerHTML={{ __html: activity.notes }} />
                    </div>
                  </div>
                )}

                {/* Associated Firms & Contacts */}
                {activity.associated_firms_contacts?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Associated Firms & Contacts
                    </p>
                    <div className="space-y-2">
                      {activity.associated_firms_contacts.map((entry, i) => (
                        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
                            <Building2 className="w-3 h-3 text-indigo-400" /> {entry.firm_name}
                          </p>
                          {entry.contacts?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pl-4">
                              {entry.contacts.map((c, j) => (
                                <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                                  <User className="w-2.5 h-2.5" /> {c.contact_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments (view mode) */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Attachments
                  </p>
                  <ActivityAttachmentsManager
                    attachments={activity.attachments || []}
                    readOnly
                    onDirectSave={(atts) => updateMutation.mutate({ attachments: atts })}
                  />
                </div>

                {/* Linked Follow-up Tasks */}
                {linkedTasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" /> Follow-up Tasks
                    </p>
                    <div className="space-y-2">
                      {linkedTasks.map((task) => (
                        <button key={task.id} type="button" onClick={() => setSelectedTask(task)}
                          className="w-full rounded-xl border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 p-3 space-y-1 text-left transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-gray-700 quill-preview flex-1 min-w-0"
                              dangerouslySetInnerHTML={{ __html: task.task_description }} />
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600"}`}>
                                {task.status}
                              </span>
                              <ChevronRight className="w-3 h-3 text-gray-400" />
                            </div>
                          </div>
                          {task.due_date && (
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Due: {fmt(task.due_date)}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add follow-up task (view mode) */}
                {!addTask ? (
                  <button type="button" onClick={() => setAddTask(true)}
                    className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <ClipboardList className="w-3.5 h-3.5" /> Add a follow-up task
                  </button>
                ) : (
                  <div className="rounded-lg border border-indigo-200 bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" /> Follow-up Task
                      </span>
                      <button type="button" onClick={() => setAddTask(false)}>
                        <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700">Task Description *</Label>
                      <div className="quill-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <ReactQuill theme="snow" value={taskDesc} onChange={setTaskDesc}
                          modules={QUILL_MODULES} placeholder="Describe the task..." style={{ minHeight: 70 }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-700">Due Date</Label>
                        <Input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-700">Status</Label>
                        <Select value={taskStatus} onValueChange={setTaskStatus}>
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
                        value={taskAssignedFirms}
                        onChange={setTaskAssignedFirms}
                        allFirms={firms}
                        allContacts={contacts}
                        originatorFirmId={(contacts.find(c => c.id === activity.contact_id)?.firm_ids || [])[0]}
                        originatorFirmName={firms.find(f => f.id === (contacts.find(c => c.id === activity.contact_id)?.firm_ids || [])[0])?.name}
                      />
                    </div>
                    {taskAssignedFirms.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assigned To</p>
                        {taskAssignedFirms.map((entry, i) => (
                          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <button
                              type="button"
                              onClick={() => onFirmClick && onFirmClick(firms.find(f => f.id === entry.firm_id))}
                              className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1 hover:text-indigo-600 transition-colors"
                            >
                              <Building2 className="w-3 h-3 text-indigo-400" /> {entry.firm_name}
                            </button>
                            {entry.contacts?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pl-4">
                                {entry.contacts.map((c, j) => (
                                  <button
                                    key={j}
                                    type="button"
                                    onClick={() => onContactClick && onContactClick(contacts.find(x => x.id === c.contact_id))}
                                    className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                                  >
                                    <User className="w-2.5 h-2.5" /> {c.contact_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <Paperclip className="w-3 h-3 text-gray-400" /> Attachments
                      </Label>
                      <ActivityAttachmentsManager attachments={taskAttachments} onChange={setTaskAttachments} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddTask(false)}>Cancel</Button>
                      <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={handleSaveTask} disabled={savingTask || !taskDesc || taskDesc === "<p><br></p>"}>
                        {savingTask ? "Saving..." : "Save Task"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
            {editing ? (
              <>
                <button type="button" onClick={() => setEditing(false)}
                  className="h-9 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={updateMutation.isPending}
                  className="flex-1 h-9 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : confirmDelete ? (
              <>
                <span className="text-xs text-red-600 font-medium flex-1">Delete this activity?</span>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(activity.id)}
                  disabled={deleteMutation.isPending}
                  className="h-8 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50">
                  {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="h-8 px-3 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button type="button" onClick={() => setEditing(true)}
                  className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button type="button" onClick={onClose}
                  className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal
          open={!!selectedTask}
          task={selectedTask}
          onClose={() => {
            setSelectedTask(null);
            queryClient.invalidateQueries({ queryKey: ["tasks_for_activity", activity?.id] });
          }}
        />
      )}
    </>
  );
}