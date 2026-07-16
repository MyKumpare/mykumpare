import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Trash2, Plus, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DeleteOptionDialog from "./DeleteOptionDialog";

export const CONTACT_TYPE_PRESETS = [
  "Allocator",
  "Investment Consultant",
  "Investment Manager",
  "Securities Broker",
  "Trade Organization Representative",
];

export default function ContactTypePicker({ value, onChange, viewMode = false }) {
  const [open, setOpen] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState([]); // [{id, name}]
  const [pendingDelete, setPendingDelete] = useState(null); // name to hide
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.ContactTypeOption.list("-created_date", 50)
      .then((rows) => {
        if (active) setHiddenOptions(rows.map((r) => ({ id: r.id, name: r.name })).filter((o) => o.name));
      })
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

  const hiddenNames = useMemo(() => hiddenOptions.map((o) => o.name), [hiddenOptions]);
  const activeNames = useMemo(
    () => CONTACT_TYPE_PRESETS.filter((p) => !hiddenNames.includes(p)),
    [hiddenNames]
  );

  const select = (name) => {
    onChange(name === value ? "" : name);
    setOpen(false);
  };

  // "Delete from master list" = hide the type by recording it as hidden.
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const row = await base44.entities.ContactTypeOption.create({ name: pendingDelete });
      setHiddenOptions((prev) => [...prev, { id: row.id, name: pendingDelete }]);
      if (value === pendingDelete) onChange("");
    } catch {}
    setPendingDelete(null);
  };

  // Restore a hidden type by removing its hidden record.
  const restorePreset = async (name) => {
    const rec = hiddenOptions.find((o) => o.name === name);
    if (!rec) return;
    try {
      await base44.entities.ContactTypeOption.delete(rec.id);
      setHiddenOptions((prev) => prev.filter((o) => o.id !== rec.id));
    } catch {}
  };

  if (viewMode) {
    return (
      <div className="text-sm px-1">
        {value ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{value}</span>
        ) : <span className="text-gray-400 italic">—</span>}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>{value || "Select type..."}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {activeNames.map((name) => (
            <div key={name} className="flex items-center justify-between text-xs hover:bg-gray-50 text-gray-700">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(name); }}
                className="flex-1 text-left px-3 py-1.5 flex items-center gap-2"
              >
                {value === name && <Check className="w-3 h-3 text-indigo-500" />}
                <span className={value === name ? "font-medium text-indigo-700" : ""}>{name}</span>
              </button>
              <button
                type="button"
                title="Delete from master list"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete(name); }}
                className="px-2 py-1.5 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {activeNames.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No types available — restore one below</div>
          )}
          {hiddenNames.length > 0 && (
            <div className="border-t border-gray-100">
              <p className="px-3 pt-1.5 text-xs text-gray-400">Hidden — click to restore</p>
              {hiddenNames.map((name) => (
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
        description={`This will hide “${pendingDelete}” from the contact type list. You can restore it later from the “Hidden” section.`}
      />
    </div>
  );
}