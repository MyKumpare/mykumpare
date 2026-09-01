import React, { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { X, Plus, AlertTriangle, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import DeleteOptionDialog from "../contacts/DeleteOptionDialog";
import { CONSULTANT_ROLE_PRESETS, findSimilarOptions } from "./consultantRoleOptions";

/**
 * Multi-select picker for investment consultant roles (e.g. General Consultant,
 * Asset Class Consultant). New custom roles are validated against existing
 * options (exact, substring, fuzzy) to avoid duplicates, then persisted to the
 * InvestmentConsultantRole master list so they're reusable across all firms.
 */
export default function ConsultantRoleMultiSelect({ value = [], onChange }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingCustom, setPendingCustom] = useState(null);
  const [savedOptions, setSavedOptions] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.InvestmentConsultantRole.list("-created_date", 200)
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
    const merged = [...CONSULTANT_ROLE_PRESETS];
    const seen = new Set(merged.map((o) => o.toLowerCase()));
    const customs = [...value, ...savedOptions.map((o) => o.name)].filter((v) => !CONSULTANT_ROLE_PRESETS.includes(v));
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
  const alreadySelected = value.some((v) => v.toLowerCase() === trimmed.toLowerCase());

  const toggle = (role) => {
    if (value.includes(role)) onChange(value.filter((r) => r !== role));
    else onChange([...value, role]);
  };

  const confirmAddCustom = (val) => {
    if (!value.some((v) => v.toLowerCase() === val.toLowerCase())) onChange([...value, val]);
    setPendingCustom(null);
    setSearch("");
    const isPreset = CONSULTANT_ROLE_PRESETS.some((o) => o.toLowerCase() === val.toLowerCase());
    const alreadySaved = savedOptions.some((o) => o.name.toLowerCase() === val.toLowerCase());
    if (!isPreset && !alreadySaved) {
      base44.entities.InvestmentConsultantRole.create({ name: val })
        .then((row) => setSavedOptions((prev) => (prev.some((o) => o.name.toLowerCase() === val.toLowerCase()) ? prev : [...prev, { id: row.id, name: val }])))
        .catch((err) => toast({ title: "Failed to save role", description: err.message || "Could not save this role.", variant: "destructive" }));
    }
  };

  const attemptAddCustom = () => {
    if (!trimmed || alreadySelected) return;
    const matches = findSimilarOptions(trimmed, allOptions);
    if (matches.length > 0) { setPendingCustom({ val: trimmed, matches }); return; }
    confirmAddCustom(trimmed);
  };

  const isDeletable = (option) =>
    !CONSULTANT_ROLE_PRESETS.includes(option) && !!savedByName[option.toLowerCase()];

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await base44.entities.InvestmentConsultantRole.delete(pendingDelete.id);
      setSavedOptions((prev) => prev.filter((o) => o.id !== pendingDelete.id));
    } catch {}
    setPendingDelete(null);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((r) => (
            <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600 text-white">
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="relative" ref={containerRef}>
        <Input
          placeholder="Search or add consultant role..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (pendingCustom) { confirmAddCustom(pendingCustom.val); return; }
              const unselectedFiltered = filtered.filter((o) => !value.includes(o));
              if (unselectedFiltered.length === 1) toggle(unselectedFiltered[0]);
              else if (trimmed && !alreadySelected) attemptAddCustom();
            }
            if (e.key === "Escape") { setShowDropdown(false); setPendingCustom(null); }
          }}
          className="h-8 text-xs"
        />

        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((option) => {
              const selected = value.includes(option);
              const deletable = isDeletable(option);
              return (
                <div key={option} className={`flex items-center justify-between text-xs transition-colors ${selected ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-50 text-gray-700"}`}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); toggle(option); }} className="flex-1 text-left px-3 py-1.5">
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
            {trimmed && alreadySelected && !pendingCustom && (
              <div className="px-3 py-2 text-xs text-amber-600 italic border-t border-gray-100">"{trimmed}" is already added</div>
            )}
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
              trimmed && !alreadySelected && (
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
      </div>

      <DeleteOptionDialog optionName={pendingDelete?.name} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
    </div>
  );
}