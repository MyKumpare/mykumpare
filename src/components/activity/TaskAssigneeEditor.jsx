/**
 * TaskAssigneeEditor
 * Allows assigning a task to one or more firms and their contacts.
 * The originator's firm is pre-populated as the first entry by default.
 * Supports adding new firms (inline form) and new contacts per firm.
 */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, User, Plus, X, ChevronDown, ChevronUp, UserPlus } from "lucide-react";

const FIRM_TYPES_ORDER = ["Allocator", "Investment Consultant", "Investment Manager", "Manager of Managers", "Securities Brokerage", "Trade Organizations"];

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
  const filtered = availableFirms.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
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
        <Plus className="w-3 h-3" /> Add another firm...
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
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

/**
 * Props:
 *  value: [{firm_id, firm_name, contacts: [{contact_id, contact_name}]}]
 *  onChange: (newValue) => void
 *  allFirms: Firm[]
 *  allContacts: Contact[]
 *  originatorFirmId: string   — pre-populated as first firm (cannot be removed if it's the only one)
 *  originatorFirmName: string
 */
export default function TaskAssigneeEditor({ value = [], onChange, allFirms, allContacts, originatorFirmId, originatorFirmName }) {
  const queryClient = useQueryClient();
  const [addingNewFirm, setAddingNewFirm] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [savingFirm, setSavingFirm] = useState(false);
  const [addingContactForFirm, setAddingContactForFirm] = useState(null);

  // Ensure originator's firm is always present as first entry
  const ensuredValue = React.useMemo(() => {
    if (!originatorFirmId) return value;
    if (value.find(e => e.firm_id === originatorFirmId)) return value;
    return [{ firm_id: originatorFirmId, firm_name: originatorFirmName || "", contacts: [] }, ...value];
  }, [value, originatorFirmId, originatorFirmName]);

  // Sync up if we added the default entry
  useEffect(() => {
    if (ensuredValue !== value) onChange(ensuredValue);
  }, []);

  const usedFirmIds = ensuredValue.map(e => e.firm_id);
  const availableFirms = allFirms.filter(f => !f.deleted_at && !usedFirmIds.includes(f.id));

  const handleAddFirm = (firm) => {
    if (ensuredValue.find(e => e.firm_id === firm.id)) return;
    onChange([...ensuredValue, { firm_id: firm.id, firm_name: firm.name, contacts: [] }]);
  };

  const handleCreateFirm = async () => {
    if (!newFirmName.trim()) return;
    setSavingFirm(true);
    const created = await base44.entities.Firm.create({ name: newFirmName.trim() });
    queryClient.invalidateQueries({ queryKey: ["all_firms_for_activities"] });
    onChange([...ensuredValue, { firm_id: created.id, firm_name: created.name, contacts: [] }]);
    setAddingNewFirm(false); setNewFirmName(""); setSavingFirm(false);
  };

  const handleAddContact = (firmId, contact) => {
    onChange(ensuredValue.map(e => {
      if (e.firm_id !== firmId) return e;
      if (e.contacts.find(c => c.contact_id === contact.id)) return e;
      return { ...e, contacts: [...e.contacts, { contact_id: contact.id, contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") }] };
    }));
  };

  const handleRemoveContact = (firmId, contactId) => {
    onChange(ensuredValue.map(e => e.firm_id !== firmId ? e : { ...e, contacts: e.contacts.filter(c => c.contact_id !== contactId) }));
  };

  const handleRemoveFirm = (firmId) => {
    // Don't remove if it's the only firm
    if (ensuredValue.length <= 1) return;
    onChange(ensuredValue.filter(e => e.firm_id !== firmId));
  };

  return (
    <div className="space-y-2">
      {ensuredValue.map((entry, idx) => {
        const firmAllContacts = allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(entry.firm_id));
        const availableContacts = firmAllContacts.filter(c => !entry.contacts.find(ec => ec.contact_id === c.id));
        const isAddingContact = addingContactForFirm === entry.firm_id;
        const isOriginatorFirm = entry.firm_id === originatorFirmId;

        return (
          <div key={entry.firm_id} className={`rounded-lg border p-2.5 space-y-2 ${isOriginatorFirm ? "border-amber-200 bg-amber-50/30" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className={`w-3.5 h-3.5 ${isOriginatorFirm ? "text-amber-500" : "text-indigo-500"}`} />
                <span className="text-xs font-semibold text-gray-700">{entry.firm_name}</span>
                {isOriginatorFirm && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Originator's firm</span>}
              </div>
              {(!isOriginatorFirm || ensuredValue.length > 1) && (
                <button type="button" onClick={() => handleRemoveFirm(entry.firm_id)} className="text-gray-300 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Selected contacts */}
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

            {/* Add existing contact from firm */}
            {availableContacts.length > 0 && (
              <Select onValueChange={(cid) => { const c = allContacts.find(x => x.id === cid); if (c) handleAddContact(entry.firm_id, c); }}>
                <SelectTrigger className="h-7 text-xs border-dashed border-gray-300 text-gray-500">
                  <SelectValue placeholder="+ Select contact from this firm..." />
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