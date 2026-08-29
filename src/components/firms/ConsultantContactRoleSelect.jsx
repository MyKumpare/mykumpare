import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Plus, AlertTriangle, Trash2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import DeleteOptionDialog from "../contacts/DeleteOptionDialog";
import { CONSULTANT_CONTACT_ROLE_PRESETS, findSimilarOptions } from "./consultantRoleOptions";

/**
 * Single-select picker for a consultant contact's role (e.g. Manager Research,
 * Field Consultant). New custom roles are validated against existing options
 * to avoid duplicates, then persisted to the ConsultantContactRole master list.
 * Also supports deleting custom (non-preset) options from the master list.
 */
export default function ConsultantContactRoleSelect({ value = "", onChange, placeholder = "Select role..." }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingCustom, setPendingCustom] = useState(null);
  const [savedOptions, setSavedOptions] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.ConsultantContactRole.list("-created_date", 200)
      .then((rows) => {
        if (active) setSavedOptions(rows.map((r) => ({ id: r.id, name: r.name })).filter((o) => o.name));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const savedByName = useMemo(() => {
    const m = {};
    savedOptions.forEach((o) => { m[o.name.toLowerCase()] = o; });
    return m;
  }, [savedOptions]);

  const allOptions = useMemo(() => {
    const merged = [...CONSULTANT_CONTACT_ROLE_PRESETS];
    const seen = new Set(merged.map((o) => o.toLowerCase()));
    const customs = [...(value ? [value] : []), ...savedOptions.map((o) => o.name)].filter((v) => !CONSULTANT_CONTACT_ROLE_PRESETS.includes(v));
    for (const c of customs) {
      const k = c.toLowerCase();
      if (!seen.has(k)) { merged.push(c); seen.add(k); }
    }
    return merged;
  }, [value, savedOptions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    const q = search.toLowerCase();
    return allOptions.filter((o) => o.toLowerCase().includes(q));
  }, [allOptions, search]);

  const trimmed = search.trim();
  const isCurrentValue = !!value;

  const select = (role) => {
    onChange(role);
    setSearch("");
    setShowDropdown(false);
  };

  const confirmAddCustom = (val) => {
    select(val);
    setPendingCustom(null);
    const isPreset = CONSULTANT_CONTACT_ROLE_PRESETS.some((o) => o.toLowerCase() === val.toLowerCase());
    const alreadySaved = savedOptions.some((o) => o.name.toLowerCase() === val.toLowerCase());
    if (!isPreset && !alreadySaved) {
      base44.entities.ConsultantContactRole.create({ name: val })
        .then((row) => setSavedOptions((prev) => (prev.some((o) => o.name.toLowerCase() === val.toLowerCase()) ? prev : [...prev, { id: row.id, name: val }])))
        .catch((err) => toast({ title: "Failed to save role", description: err.message || "Could not save this role.", variant: "destructive" }));
    }
  };

  const attemptAddCustom = () => {
    if (!trimmed) return;
    const matches = findSimilarOptions(trimmed, allOptions);
    if (matches.length > 0) { setPendingCustom({ val: trimmed, matches }); return; }
    confirmAddCustom(trimmed);
  };

  const isDeletable = (option) =>
    !CONSULTANT_CONTACT_ROLE_PRESETS.includes(option) && !!savedByName[option.toLowerCase()];

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await base44.entities.ConsultantContactRole.delete(pendingDelete.id);
      setSavedOptions((prev) => prev.filter((o) => o.id !== pendingDelete.id));
      if (value === pendingDelete.name) onChange("");
    } catch {}
    setPendingDelete(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button showing the selected value */}
      <button
        type="button"
        onClick={() => setShowDropdown((v) => !v)}
        className="w-full h-8 px-2.5 flex items-center justify-between text-xs rounded-md border border-gray-200 bg-white hover:border-gray-300 transition-colors"
      >
        <span className={value ? "text-gray-800 truncate" : "text-gray-400"}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(""); }}
              className="text-gray-400 hover:text-red-500 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </button>

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              placeholder="Search or add role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (pendingCustom) { confirmAddCustom(pendingCustom.val); return; }
                  const unselectedFiltered = filtered.filter((o) => o !== value);
                  if (unselectedFiltered.length === 1) select(unselectedFiltered[0]);
                  else if (trimmed) attemptAddCustom();
                }
                if (e.key === "Escape") { setShowDropdown(false); setPendingCustom(null); }
              }}
              className="w-full h-7 px-2 text-xs rounded border border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
            />
          </div>

          {filtered.map((option) => {
            const selected = value === option;
            const deletable = isDeletable(option);
            return (
              <div key={option} className={`flex items-center justify-between text-xs transition-colors ${selected ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-50 text-gray-700"}`}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); select(option); }} className="flex-1 text-left px-3 py-1.5">
                  {option}
                </button>
                {selected && <span className="text-indigo-400 text-xs pr-1">✓</span>}
                {deletable && (
                  <button type="button" title="Delete from master list" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete({ id: savedByName[option.toLowerCase()].id, name: option }); }} className="px-2 py-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {pendingCustom ? (
            <div className="border-t border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Similar role{pendingCustom.matches.length > 1 ? "s" : ""} already exist{pendingCustom.matches.length === 1 ? "s" : ""}:
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingCustom.matches.map((m) => (
                  <span key={m} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{m}</span>
                ))}
              </div>
              <p className="text-xs text-amber-700">Add "{pendingCustom.val}" anyway?</p>
              <div className="flex gap-2 pt-0.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); confirmAddCustom(pendingCustom.val); }} className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700">Add anyway</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setPendingCustom(null); }} className="px-2.5 py-1 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            trimmed && (
              <button type="button" onMouseDown={(e) => { e.preventDefault(); attemptAddCustom(); }} className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 border-t border-gray-100 font-medium">
                <Plus className="w-3 h-3" /> Add "{trimmed}"
              </button>
            )
          )}
          {filtered.length === 0 && !trimmed && (
            <div className="px-3 py-2 text-xs text-gray-400 italic">Type to search roles...</div>
          )}
        </div>
      )}

      <DeleteOptionDialog optionName={pendingDelete?.name} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
    </div>
  );
}