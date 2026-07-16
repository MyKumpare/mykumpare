import React, { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { X, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DeleteOptionDialog from "./DeleteOptionDialog";

export const DEFAULT_CONTACT_DEPARTMENT_OPTIONS = [
  "Administration",
  "Board Member",
  "Compliance and Legal",
  "Executive",
  "Investments",
  "Marketing and Client Services",
  "Operations",
  "Others",
];

export default function ContactDepartmentPicker({ value = [], onChange, viewMode = false }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedOptions, setSavedOptions] = useState([]); // [{id, name}]
  const [pendingDelete, setPendingDelete] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.ContactDepartmentOption.list("-created_date", 200)
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
    const merged = [...DEFAULT_CONTACT_DEPARTMENT_OPTIONS];
    const seen = new Set(merged.map((o) => o.toLowerCase()));
    for (const c of [...value, ...savedOptions.map((o) => o.name)]) {
      if (DEFAULT_CONTACT_DEPARTMENT_OPTIONS.includes(c)) continue;
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

  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  const addCustom = (val) => {
    if (!value.some((v) => v.toLowerCase() === val.toLowerCase())) onChange([...value, val]);
    setSearch("");
    const isPreset = DEFAULT_CONTACT_DEPARTMENT_OPTIONS.some((o) => o.toLowerCase() === val.toLowerCase());
    const alreadySaved = savedOptions.some((o) => o.name.toLowerCase() === val.toLowerCase());
    if (!isPreset && !alreadySaved) {
      base44.entities.ContactDepartmentOption.create({ name: val })
        .then((row) => setSavedOptions((prev) => [...prev, { id: row.id, name: row.name }]))
        .catch(() => {});
    }
  };

  const isDeletable = (option) =>
    !DEFAULT_CONTACT_DEPARTMENT_OPTIONS.includes(option) && !!savedByName[option.toLowerCase()];

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await base44.entities.ContactDepartmentOption.delete(pendingDelete.id);
      setSavedOptions((prev) => prev.filter((o) => o.id !== pendingDelete.id));
    } catch {}
    setPendingDelete(null);
  };

  if (viewMode) {
    return (
      <div className="flex flex-wrap gap-1.5 px-1">
        {value.length > 0
          ? value.map((r) => (
              <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{r}</span>
            ))
          : <span className="text-gray-400 italic">—</span>}
      </div>
    );
  }

  const exactMatchExists = filtered.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600 text-white">
              {r}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== r))} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative" ref={containerRef}>
        <Input
          placeholder="Search or add department..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (trimmed && !alreadySelected && !exactMatchExists) addCustom(trimmed);
            }
            if (e.key === "Escape") setShowDropdown(false);
          }}
          className="h-8 text-xs"
        />

        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((option) => {
              const selected = value.includes(option);
              const deletable = isDeletable(option);
              return (
                <div
                  key={option}
                  className={`flex items-center justify-between text-xs transition-colors ${selected ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                >
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); toggle(option); }} className="flex-1 text-left px-3 py-1.5">
                    {option}
                  </button>
                  {selected && <span className="text-indigo-400 text-xs pr-1">✓</span>}
                  {deletable && (
                    <button
                      type="button"
                      title="Delete from master list"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete({ id: savedByName[option.toLowerCase()].id, name: option }); }}
                      className="px-2 py-1.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {trimmed && !alreadySelected && !exactMatchExists && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addCustom(trimmed); }}
                className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 border-t border-gray-100 font-medium"
              >
                <Plus className="w-3 h-3" /> Add “{trimmed}”
              </button>
            )}
            {filtered.length === 0 && !trimmed && (
              <div className="px-3 py-2 text-xs text-gray-400 italic">Type to search departments...</div>
            )}
          </div>
        )}
      </div>

      <DeleteOptionDialog
        optionName={pendingDelete?.name}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}