import React, { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { X, Plus, AlertTriangle, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DeleteOptionDialog from "../contacts/DeleteOptionDialog";

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[n];
}
const similarity = (a, b) => {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
};

// Reusable multi-select picker for document categories / sub-categories.
// Supports search, add-new (with fuzzy duplicate prevention), and delete from
// the persisted master list (entityName -> base44.entities[entityName]).
export default function DocumentCategoryPicker({
  value = [],
  onChange,
  entityName,
  placeholder = "Search or add...",
  emptyHint = "Type to add a new option...",
  accent = "indigo",
}) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingCustom, setPendingCustom] = useState(null); // { val, matches }
  const [savedOptions, setSavedOptions] = useState([]); // [{id, name}]
  const [pendingDelete, setPendingDelete] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities[entityName]
      .list("-created_date", 500)
      .then((rows) => {
        if (active)
          setSavedOptions(
            rows.map((r) => ({ id: r.id, name: r.name })).filter((o) => o.name)
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [entityName]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const savedByName = useMemo(() => {
    const m = {};
    savedOptions.forEach((o) => {
      m[o.name.toLowerCase()] = o;
    });
    return m;
  }, [savedOptions]);

  const allOptions = useMemo(() => {
    const merged = [];
    const seen = new Set();
    const add = (name) => {
      if (!name) return;
      const k = name.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(name);
      }
    };
    savedOptions.forEach((o) => add(o.name));
    value.forEach((v) => add(v));
    return merged;
  }, [value, savedOptions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    const q = search.toLowerCase();
    return allOptions.filter((o) => o.toLowerCase().includes(q));
  }, [allOptions, search]);

  const trimmed = search.trim();
  const alreadySelected = value.some(
    (v) => v.toLowerCase() === trimmed.toLowerCase()
  );

  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };

  const findSimilar = (val) => {
    const target = normalize(val);
    if (!target) return [];
    const seen = new Set();
    const matches = [];
    for (const o of allOptions) {
      const n = normalize(o);
      if (seen.has(n)) continue;
      seen.add(n);
      const isExact = n === target;
      const isSubstring = n.includes(target) || target.includes(n);
      const isFuzzy = similarity(n, target) >= 0.82;
      if (isExact || isSubstring || isFuzzy) matches.push(o);
    }
    return matches;
  };

  const confirmAddCustom = (val) => {
    if (!value.some((v) => v.toLowerCase() === val.toLowerCase()))
      onChange([...value, val]);
    setPendingCustom(null);
    setSearch("");
    const alreadySaved = savedOptions.some(
      (o) => o.name.toLowerCase() === val.toLowerCase()
    );
    if (!alreadySaved) {
      base44.entities[entityName]
        .create({ name: val })
        .then((row) =>
          setSavedOptions((prev) =>
            prev.some((o) => o.name.toLowerCase() === val.toLowerCase())
              ? prev
              : [...prev, { id: row.id, name: val }]
          )
        )
        .catch(() => {});
    }
  };

  const attemptAddCustom = () => {
    const val = trimmed;
    if (!val || alreadySelected) return;
    const matches = findSimilar(val);
    if (matches.length > 0) {
      setPendingCustom({ val, matches });
      return;
    }
    confirmAddCustom(val);
  };

  const isDeletable = (option) => !!savedByName[option.toLowerCase()];

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await base44.entities[entityName].delete(pendingDelete.id);
      setSavedOptions((prev) => prev.filter((o) => o.id !== pendingDelete.id));
    } catch {
      /* ignore */
    }
    setPendingDelete(null);
  };

  const badgeBg = accent === "amber" ? "bg-amber-600" : "bg-indigo-600";
  const selBg = accent === "amber" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700";

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((r) => (
            <span
              key={r}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeBg} text-white`}
            >
              {r}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== r))}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative" ref={containerRef}>
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (pendingCustom) {
                confirmAddCustom(pendingCustom.val);
                return;
              }
              const unselected = filtered.filter((o) => !value.includes(o));
              if (unselected.length === 1) toggle(unselected[0]);
              else if (trimmed && !alreadySelected) attemptAddCustom();
            }
            if (e.key === "Escape") {
              setShowDropdown(false);
              setPendingCustom(null);
            }
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
                  className={`flex items-center justify-between text-xs transition-colors ${
                    selected ? `${selBg} font-medium` : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggle(option);
                    }}
                    className="flex-1 text-left px-3 py-1.5"
                  >
                    {option}
                  </button>
                  {selected && <span className="text-xs pr-1">✓</span>}
                  {deletable && (
                    <button
                      type="button"
                      title="Delete from master list"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPendingDelete({
                          id: savedByName[option.toLowerCase()].id,
                          name: option,
                        });
                      }}
                      className="px-2 py-1.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {trimmed && alreadySelected && !pendingCustom && (
              <div className="px-3 py-2 text-xs text-amber-600 italic border-t border-gray-100">
                "{trimmed}" is already added
              </div>
            )}
            {pendingCustom ? (
              <div className="border-t border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Similar entr
                  {pendingCustom.matches.length > 1 ? "ies" : "y"} already exist
                  {pendingCustom.matches.length === 1 ? "s" : ""}:
                </p>
                <div className="flex flex-wrap gap-1">
                  {pendingCustom.matches.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-amber-700">Add "{pendingCustom.val}" anyway?</p>
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      confirmAddCustom(pendingCustom.val);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Add anyway
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setPendingCustom(null);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              trimmed &&
              !alreadySelected && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    attemptAddCustom();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 border-t border-gray-100 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add "{trimmed}"
                </button>
              )
            )}
            {filtered.length === 0 && !trimmed && (
              <div className="px-3 py-2 text-xs text-gray-400 italic">{emptyHint}</div>
            )}
          </div>
        )}
      </div>

      <DeleteOptionDialog
        optionName={pendingDelete?.name}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        description={`This will remove "${pendingDelete?.name || ""}" from the master list so it can no longer be selected for any document. This cannot be undone.`}
      />
    </div>
  );
}