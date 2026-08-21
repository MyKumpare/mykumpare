import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Search, Check } from "lucide-react";

function fullName(c) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "(Unnamed)";
}

export default function ConferenceAttendeePicker({ contacts, selectedIds, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...contacts]
      .filter(c => !c.deleted_at)
      .filter(c => !q || fullName(c).toLowerCase().includes(q))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [contacts, query]);

  const selected = useMemo(() => {
    const idSet = new Set(selectedIds || []);
    return (contacts || []).filter(c => idSet.has(c.id));
  }, [contacts, selectedIds]);

  const toggle = (id) => {
    const set = new Set(selectedIds || []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-indigo-600 disabled:opacity-50"
        >
          <Users className="w-3 h-3" />
          Attendees
          {selected.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-gray-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search colleagues..."
              className="w-full h-8 rounded-md border border-gray-200 bg-white pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">No colleagues found.</p>
          ) : (
            sorted.map(c => {
              const checked = (selectedIds || []).includes(c.id);
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(c.id)}
                    className="flex-shrink-0"
                  />
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                      {fullName(c).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-gray-700 truncate">{fullName(c)}</span>
                  {c.title && <span className="text-[10px] text-gray-400 truncate ml-auto">{c.title}</span>}
                </label>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="p-2 border-t border-gray-100 text-[10px] text-gray-500">
            {selected.length} colleague{selected.length !== 1 ? "s" : ""} selected
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ConferenceAttendeeChips({ contacts, selectedIds }) {
  const selected = useMemo(() => {
    const idSet = new Set(selectedIds || []);
    return (contacts || []).filter(c => idSet.has(c.id));
  }, [contacts, selectedIds]);

  if (selected.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {selected.map(c => (
        <div key={c.id} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-full pl-0.5 pr-2 py-0.5">
          {c.photo_url ? (
            <img src={c.photo_url} alt="" className="w-4 h-4 rounded-full object-cover" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 text-[8px] font-semibold flex items-center justify-center">
              {fullName(c).charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[10px] text-indigo-700 font-medium">{fullName(c)}</span>
        </div>
      ))}
    </div>
  );
}