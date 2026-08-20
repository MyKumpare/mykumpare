import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, User, UserPlus, Plus, ChevronDown, ChevronUp, X } from "lucide-react";

const FIRM_TYPES_ORDER = [
  "Allocator", "Investment Consultant", "Investment Manager",
  "Securities Brokerage", "Trade Organizations",
];

// ── Searchable firm picker (type-aware) ──────────────────────────────────────
export function FirmPickerDropdown({ availableFirms, onSelect, onAddNew, placeholder = "+ Add a firm..." }) {
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

  const isSearching = search.trim().length > 0;

  const filtered = availableFirms.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.firm_types || [f.firm_type]).filter(Boolean).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const grouped = {};
  FIRM_TYPES_ORDER.forEach(t => { grouped[t] = []; });
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
        <Plus className="w-3 h-3" /> {placeholder}
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
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
                {onAddNew && activeTypes.length > 0 && (
                  <div className="px-3 py-2 border-t border-gray-100">
                    <button type="button" onClick={() => { setOpen(false); onAddNew(); }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <Plus className="w-3 h-3" /> Add new firm not in list
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Originator firm+contact picker ────────────────────────────────────────────
export default function OriginatorPicker({ allFirms, allContacts, firmId, firmName, firmType, contactId, contactName, onChange }) {
  const [addingContact, setAddingContact] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const queryClient = useQueryClient();

  const firmContacts = useMemo(
    () => allContacts.filter(c => !c.deleted_at && (c.firm_ids || []).includes(firmId)),
    [allContacts, firmId]
  );

  const handleSelectFirm = ({ firm, firmType }) => {
    onChange({ firmId: firm.id, firmName: firm.name, firmType: firmType || null, contactId: "", contactName: "" });
  };

  const handleSelectContact = (contact) => {
    onChange({ firmId, firmName, contactId: contact.id, contactName: [contact.first_name, contact.last_name].filter(Boolean).join(" ") });
  };

  const handleCreateContact = async () => {
    if (!newFirst.trim() || !newLast.trim() || !firmId) return;
    setSavingContact(true);
    const created = await base44.entities.Contact.create({
      first_name: newFirst.trim(), last_name: newLast.trim(),
      title: newTitle.trim() || undefined, firm_ids: [firmId],
    });
    queryClient.invalidateQueries({ queryKey: ["all_contacts_for_activities"] });
    onChange({ firmId, firmName, contactId: created.id, contactName: [created.first_name, created.last_name].filter(Boolean).join(" ") });
    setAddingContact(false); setNewFirst(""); setNewLast(""); setNewTitle("");
    setSavingContact(false);
  };

  const availableFirms = allFirms.filter(f => !f.deleted_at);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
        <Building2 className="w-3 h-3 text-indigo-500" /> Firm <span className="text-red-500">*</span>
      </Label>
      {firmId ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
          <Building2 className="w-3.5 h-3.5 text-indigo-500" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-indigo-700">{firmName}</span>
            {firmType && <span className="ml-1.5 text-[10px] text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded-full">{firmType}</span>}
          </div>
          <button type="button" onClick={() => onChange({ firmId: "", firmName: "", firmType: null, contactId: "", contactName: "" })} className="text-indigo-300 hover:text-red-500">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <FirmPickerDropdown availableFirms={availableFirms} onSelect={handleSelectFirm} placeholder="Select originating firm..." />
      )}

      {firmId && (
        <>
          <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <User className="w-3 h-3 text-indigo-500" /> Contact (Originator) <span className="text-red-500">*</span>
          </Label>
          {contactId ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-medium text-indigo-700 flex-1">{contactName}</span>
              <button type="button" onClick={() => onChange({ firmId, firmName, contactId: "", contactName: "" })} className="text-indigo-300 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : !addingContact ? (
            <div className="space-y-1">
              {firmContacts.length > 0 && (
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {firmContacts.map(c => (
                    <button key={c.id} type="button" onClick={() => handleSelectContact(c)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-indigo-50 text-left transition-colors border border-gray-100">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
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
              {firmContacts.length === 0 && <p className="text-xs text-gray-400 italic py-1">No contacts for this firm.</p>}
              <button type="button" onClick={() => setAddingContact(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                <UserPlus className="w-3.5 h-3.5" /> Add a new contact for this firm
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">First Name *</Label>
                  <Input value={newFirst} onChange={e => setNewFirst(e.target.value)} className="h-7 text-xs" placeholder="First..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">Last Name *</Label>
                  <Input value={newLast} onChange={e => setNewLast(e.target.value)} className="h-7 text-xs" placeholder="Last..." />
                </div>
              </div>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-7 text-xs" placeholder="Title (optional)" />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddingContact(false)}>Cancel</Button>
                <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!newFirst.trim() || !newLast.trim() || savingContact} onClick={handleCreateContact}>
                  {savingContact ? "Saving..." : "Add & Select"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}