import React, { useState, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Filter categories mapped to Contact entity fields.
// Classification -> role/type/employment, Demographics -> gender/ethnicity/disability,
// Ownership -> veteran_status (the contact field carrying "Veteran Owned" values).
export const FIELD_GROUPS = [
  {
    label: "Classification",
    fields: [
      { key: "contact_type", label: "Contact Type" },
      { key: "contact_role", label: "Role" },
      { key: "employee_status", label: "Employee Status" },
    ],
  },
  {
    label: "Demographics",
    fields: [
      { key: "gender", label: "Gender" },
      { key: "ethnicity", label: "Ethnicity", isArray: true },
      { key: "disability_status", label: "Disability Status" },
    ],
  },
  {
    label: "Ownership",
    fields: [
      { key: "veteran_status", label: "Veteran Ownership" },
    ],
  },
];

function getFieldValues(c, f) {
  const v = c[f.key];
  return f.isArray ? (Array.isArray(v) ? v : []) : v ? [v] : [];
}

// Pure filter: text search (name/title/email/type/designations) ANDed with
// per-field multi-select (OR within a field, AND across fields). Selected is
// { [fieldKey]: Set<string> }.
export function filterContacts(contacts, text, selected) {
  const q = text.trim().toLowerCase();
  return contacts.filter((c) => {
    if (q) {
      const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ").toLowerCase();
      const haystack = [name, c.title || "", c.email || "", c.contact_type || "", (c.designations || []).join(" ")].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const sel = selected[f.key];
        if (!sel || sel.size === 0) continue;
        const vals = getFieldValues(c, f);
        const matches = vals.some((v) => sel.has(v));
        const matchesUnclassified = sel.has("__unclassified__") && vals.length === 0;
        if (!matches && !matchesUnclassified) return false;
      }
    }
    // Contact-status filter (toggled from the chart footer, not the filters panel).
    const statusSel = selected.contact_status;
    if (statusSel && statusSel.size > 0) {
      const status = c.contact_status || "Active";
      if (!statusSel.has(status)) return false;
    }
    return true;
  });
}

export default function ContactsTabFilters({ contacts, text, onTextChange, selected, onToggle, onClear }) {
  const [showFilters, setShowFilters] = useState(false);

  // Derive available options from the current contact set so only relevant
  // values appear (fields with no data are hidden entirely).
  const options = useMemo(() => {
    const opts = {};
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        const set = new Set();
        for (const c of contacts) getFieldValues(c, f).forEach((v) => v && set.add(v));
        opts[f.key] = Array.from(set).sort();
      }
    }
    return opts;
  }, [contacts]);

  const activeCount = Object.values(selected).reduce((n, s) => n + (s ? s.size : 0), 0) + (text.trim() ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Search by name, title, email..."
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs whitespace-nowrap"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px]">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Filter contacts</span>
            {activeCount > 0 && (
              <button type="button" onClick={onClear} className="text-xs text-indigo-600 hover:underline">
                Clear all
              </button>
            )}
          </div>
          {FIELD_GROUPS.map((group) => {
            const hasAny = group.fields.some((f) => (options[f.key] || []).length > 0);
            if (!hasAny) return null;
            return (
              <div key={group.label} className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-700">{group.label}</p>
                {group.fields.map((f) => {
                  const opts = options[f.key] || [];
                  if (opts.length === 0) return null;
                  return (
                    <div key={f.key} className="space-y-1">
                      <span className="text-[11px] text-gray-500">{f.label}</span>
                      <div className="flex flex-wrap gap-1">
                        {opts.map((v) => {
                          const active = selected[f.key]?.has(v);
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => onToggle(f.key, v)}
                              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"}`}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}