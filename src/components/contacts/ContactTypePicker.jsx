import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Trash2, Plus, Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DeleteOptionDialog from "./DeleteOptionDialog";
import { findContactTypeDuplicates } from "./contactTypeSimilarity";

export const CONTACT_TYPE_PRESETS = [
  "Allocator",
  "Investment Consultant",
  "Investment Manager",
  "Securities Broker",
  "Trade Organization Representative",
];

// Maps firm types to the corresponding contact type.
export const FIRM_TYPE_TO_CONTACT_TYPE = {
  "Allocator": "Allocator",
  "Investment Consultant": "Investment Consultant",
  "Investment Manager": "Investment Manager",
  "Securities Brokerage": "Securities Broker",
  "Trade Organizations": "Trade Organization Representative",
  "Manager of Managers": "Investment Manager",
};

/**
 * Returns the default contact type(s) for a given firm, based on the firm's
 * firm_types (multi-select) or firm_type (legacy single value).
 */
export function defaultContactTypesFromFirm(firm) {
  if (!firm) return [];
  const firmTypes = firm.firm_types?.length > 0
    ? firm.firm_types
    : (firm.firm_type ? [firm.firm_type] : []);
  const contactTypes = firmTypes.map((ft) => FIRM_TYPE_TO_CONTACT_TYPE[ft]).filter(Boolean);
  return [...new Set(contactTypes)];
}

export default function ContactTypePicker({ value, onChange, viewMode = false }) {
  const [open, setOpen] = useState(false);
  const [optionRows, setOptionRows] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState(null);
  const containerRef = useRef(null);

  // value is always treated as an array (backward-compatible with old string values)
  const selected = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  useEffect(() => {
    let active = true;
    base44.entities.ContactTypeOption.list("-created_date", 500)
      .then((rows) => { if (active) setOptionRows(rows); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ContactTypeOption records whose name matches a preset = "hidden" presets.
  const hiddenPresetNames = useMemo(
    () => optionRows.map((r) => r.name).filter((n) => CONTACT_TYPE_PRESETS.includes(n)),
    [optionRows]
  );
  // ContactTypeOption records whose name does NOT match a preset = custom types.
  const customTypes = useMemo(
    () => optionRows.filter((r) => !CONTACT_TYPE_PRESETS.includes(r.name)).map((r) => ({ id: r.id, name: r.name })),
    [optionRows]
  );

  // Available types = (presets not hidden) + custom types
  const availableTypes = useMemo(
    () => [
      ...CONTACT_TYPE_PRESETS.filter((p) => !hiddenPresetNames.includes(p)),
      ...customTypes.map((c) => c.name),
    ],
    [hiddenPresetNames, customTypes]
  );

  const toggle = (name) => {
    if (selected.includes(name)) {
      onChange(selected.filter((t) => t !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const removeSelected = (name) => {
    onChange(selected.filter((t) => t !== name));
  };

  // Add new type with duplicate validation
  const startAddNew = () => {
    const name = newName.trim();
    if (!name) return;
    const allNames = [...availableTypes, ...hiddenPresetNames];
    const matches = findContactTypeDuplicates(name, allNames);
    if (matches.length > 0) {
      setDuplicateMatches({ name, matches });
      return;
    }
    confirmAddNew(name);
  };

  const confirmAddNew = async (name) => {
    setAdding(true);
    try {
      const row = await base44.entities.ContactTypeOption.create({ name });
      setOptionRows((prev) => [...prev, row]);
      setNewName("");
      setDuplicateMatches(null);
      // Auto-select the newly added type
      onChange([...selected, name]);
    } catch {}
    setAdding(false);
  };

  const acceptDuplicate = () => {
    if (duplicateMatches) confirmAddNew(duplicateMatches.name);
  };

  const rejectDuplicate = () => {
    setDuplicateMatches(null);
  };

  // Delete or hide a type
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const name = pendingDelete;
    // Remove from selected
    onChange(selected.filter((t) => t !== name));
    if (CONTACT_TYPE_PRESETS.includes(name)) {
      // Hide preset by creating a ContactTypeOption record
      try {
        const row = await base44.entities.ContactTypeOption.create({ name });
        setOptionRows((prev) => [...prev, row]);
      } catch {}
    } else {
      // Delete custom type
      const rec = customTypes.find((c) => c.name === name);
      if (rec) {
        try {
          await base44.entities.ContactTypeOption.delete(rec.id);
          setOptionRows((prev) => prev.filter((r) => r.id !== rec.id));
        } catch {}
      }
    }
    setPendingDelete(null);
  };

  // Restore a hidden preset
  const restorePreset = async (name) => {
    const rec = optionRows.find((r) => r.name === name);
    if (!rec) return;
    try {
      await base44.entities.ContactTypeOption.delete(rec.id);
      setOptionRows((prev) => prev.filter((r) => r.id !== rec.id));
    } catch {}
  };

  if (viewMode) {
    return (
      <div className="text-sm px-1 flex flex-wrap gap-1">
        {selected.length > 0 ? (
          selected.map((t) => (
            <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{t}</span>
          ))
        ) : <span className="text-gray-400 italic">—</span>}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected chips + trigger */}
      <div className="min-h-9 flex flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm cursor-pointer" onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 && <span className="text-gray-400 text-xs px-1">Select type(s)...</span>}
        {selected.map((t) => (
          <span key={t} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            {t}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeSelected(t); }}
              className="hover:text-indigo-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <ChevronDown className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {/* Available types with checkboxes */}
          {availableTypes.map((name) => (
            <div key={name} className="flex items-center justify-between text-xs hover:bg-gray-50 text-gray-700">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); toggle(name); }}
                className="flex-1 text-left px-3 py-1.5 flex items-center gap-2"
              >
                {selected.includes(name) && <Check className="w-3 h-3 text-indigo-500" />}
                <span className={selected.includes(name) ? "font-medium text-indigo-700" : ""}>{name}</span>
              </button>
              <button
                type="button"
                title={CONTACT_TYPE_PRESETS.includes(name) ? "Hide from list" : "Delete from list"}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete(name); }}
                className="px-2 py-1.5 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {availableTypes.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No types available — restore one below</div>
          )}

          {/* Add new type */}
          <div className="border-t border-gray-100 p-2">
            {!duplicateMatches ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); startAddNew(); } }}
                  placeholder="Add new type..."
                  className="flex-1 h-8 text-xs px-2 rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); startAddNew(); }}
                  disabled={adding || !newName.trim()}
                  className="flex items-center gap-1 px-2 h-8 rounded-md text-xs bg-indigo-600 text-white disabled:opacity-50"
                >
                  {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Possible duplicate</p>
                    <p>&ldquo;{duplicateMatches.name}&rdquo; may already exist:</p>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {duplicateMatches.matches.map((m, i) => (
                    <div key={i} className="rounded border border-amber-200 bg-white px-2 py-1 text-xs">
                      <span className="font-medium text-gray-800">{m.name}</span>
                      <span className="text-gray-400 ml-2">{Math.round(m.score * 100)}% match</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); rejectDuplicate(); }} className="flex-1 h-7 rounded-md text-xs border border-gray-300 bg-white">Reject</button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); acceptDuplicate(); }} className="flex-1 h-7 rounded-md text-xs bg-indigo-600 text-white">Accept &amp; Add</button>
                </div>
              </div>
            )}
          </div>

          {/* Hidden presets - restore */}
          {hiddenPresetNames.length > 0 && (
            <div className="border-t border-gray-100">
              <p className="px-3 pt-1.5 text-xs text-gray-400">Hidden — click to restore</p>
              {hiddenPresetNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); restorePreset(name); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <DeleteOptionDialog
        optionName={pendingDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        description={pendingDelete && CONTACT_TYPE_PRESETS.includes(pendingDelete)
          ? `This will hide "${pendingDelete}" from the contact type list. You can restore it later from the "Hidden" section.`
          : `This will permanently delete "${pendingDelete}" from the contact type list.`}
      />
    </div>
  );
}