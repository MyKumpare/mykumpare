import React, { useState, useMemo, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, X, Plus, Check, UserCircle2, Pencil } from "lucide-react";

const getFullName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

// Sort key based on first name then last name, excluding salutation/suffix.
const getSortName = (c) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || getFullName(c);

/**
 * Inline primary/secondary Xponance-contact assignment cell for dashboard rows.
 * Shows the current assignment with change/clear controls, or an "Assign" button.
 * Persists changes directly via Firm.update / Contact.update and calls onSaved
 * so the parent can refresh its query cache.
 *
 * Props:
 *  - entityType: "Firm" | "Contact"
 *  - entityId: id of the firm/contact record being assigned
 *  - role: "primary" | "secondary"
 *  - value: { contact_id, contact_name } — current assignment
 *  - excludeId: contact id to exclude from the list (the other role's assignment)
 *  - xponanceContacts: list of Xponance (tenant) contacts to pick from
 *  - onSaved: () => void — called after a successful persist
 */
export default function XponanceAssignmentCell({
  entityType, entityId, role, value, excludeId, xponanceContacts, onSaved,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [panelPos, setPanelPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const filtered = useMemo(() => {
    let list = xponanceContacts || [];
    if (excludeId) list = list.filter((c) => c.id !== excludeId);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const name = getFullName(c).toLowerCase();
        const title = (c.title || "").toLowerCase();
        return name.includes(q) || title.includes(q);
      });
    }
    return [...list].sort((a, b) => getSortName(a).localeCompare(getSortName(b)));
  }, [xponanceContacts, search, excludeId]);

  const openPanel = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 280) });
    }
    setSearch("");
    setOpen(true);
  };

  const persist = async (contactId, contactName) => {
    if (!entityId) return;
    setSaving(true);
    try {
      const idField = role === "primary" ? "primary_xponance_contact_id" : "secondary_xponance_contact_id";
      const nameField = role === "primary" ? "primary_xponance_contact_name" : "secondary_xponance_contact_name";
      const payload = contactId
        ? { [idField]: contactId, [nameField]: contactName }
        : { [idField]: "", [nameField]: "" };
      if (entityType === "Firm") {
        await base44.entities.Firm.update(entityId, payload);
      } else if (entityType === "Product") {
        await base44.entities.Product.update(entityId, payload);
      } else {
        await base44.entities.Contact.update(entityId, payload);
      }
      onSaved?.();
      setOpen(false);
    } catch (err) {
      console.error("Failed to update Xponance assignment:", err);
    } finally {
      setSaving(false);
    }
  };

  const badge = role === "primary" ? "bg-indigo-100 text-indigo-700" : "bg-violet-100 text-violet-700";
  const letter = role === "primary" ? "P" : "S";

  return (
    <div className="relative" ref={ref}>
      {value?.contact_id ? (
        <div className="flex items-center gap-1.5 group">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${badge} text-[10px] font-bold flex-shrink-0`}>{letter}</span>
          <span className="text-sm text-gray-700 truncate max-w-[140px]">{value.contact_name}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button type="button" onClick={openPanel} disabled={saving} title="Change" className="text-gray-400 hover:text-indigo-600 p-0.5">
              <Pencil className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => persist("", "")} disabled={saving} title="Clear" className="text-gray-400 hover:text-red-500 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={openPanel} disabled={saving} title="Assign" className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 px-1.5 py-0.5 rounded-md transition-colors">
          <Plus className="w-3 h-3" />
          Assign
        </button>
      )}

      {open && panelPos && (
        <div className="fixed z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-xl" style={{ top: panelPos.top, left: panelPos.left }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              placeholder="Search Xponance contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setSearch(""); } }}
              className="w-full pl-8 pr-8 h-9 border-0 border-b text-sm focus:outline-none rounded-t-lg"
            />
            <button onClick={() => { setOpen(false); setSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-gray-400 italic py-3">No Xponance contacts found</p>
            ) : (
              filtered.map((c) => (
                <button key={c.id} type="button" onClick={() => persist(c.id, getFullName(c))} disabled={saving}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 transition-colors">
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle2 className="w-4 h-4 text-indigo-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{getFullName(c)}</p>
                    {c.title && <p className="text-xs text-gray-400 truncate">{c.title}</p>}
                  </div>
                  {value?.contact_id === c.id && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}