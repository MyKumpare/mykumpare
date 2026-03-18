import React, { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

export const CONTACT_ROLE_OPTIONS = [
  "Board Member",
  "Board Chair",
  "Board Co-Chair",
  "Executive Director",
  "Deputy Executive Director",
  "Chief Investment Officer",
  "Deputy Chief Investment Officer",
  "Portfolio Manager",
  "Co-Portfolio Manager",
  "Director of Research",
  "Deputy Director of Research",
  "Research Analyst",
  "Junior Research Analyst",
  "Senior Investment Officer",
  "Investment Officer",
  "Junior Investment Officer",
  "Senior Field Researcher",
  "Field Researcher",
  "Junior Field Researcher",
  "Senior Field Consultant",
  "Field Consultant",
  "Junior Field Consultant",
  "Director of Operations",
  "Senior Operations Analyst",
  "Operations Analyst",
  "Junior Analyst",
  "Director of Trading",
  "Senior Trader",
  "Trader",
  "Junior Trader",
  "Chief Compliance Officer",
  "Deputy Compliance Officer",
  "Senior Compliance Manager",
  "Compliance Manager",
  "Senior Compliance Analyst",
  "Compliance Analyst",
  "Junior Compliance Analyst",
  "Director of Marketing",
  "Senior Marketing Manager",
  "Marketing Manager",
  "Marketing Associates",
  "Junior Marketing Associates",
  "Director of Information Technology",
  "Senior Information Technology Manager",
  "Senior Information Technology Analyst",
  "Information Technology Analyst",
  "Junior Information Technology Analyst",
];

export default function ContactRolePicker({ value = [], onChange, viewMode = false }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = useMemo(() => {
    const custom = value.filter(v => !CONTACT_ROLE_OPTIONS.includes(v));
    return [...CONTACT_ROLE_OPTIONS, ...custom];
  }, [value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    const q = search.toLowerCase();
    return allOptions.filter(o => o.toLowerCase().includes(q));
  }, [allOptions, search]);

  const trimmed = search.trim();
  const exactMatch = allOptions.some(o => o.toLowerCase() === trimmed.toLowerCase());
  const alreadySelected = value.some(v => v.toLowerCase() === trimmed.toLowerCase());

  const toggle = (role) => {
    if (value.includes(role)) {
      onChange(value.filter(r => r !== role));
    } else {
      onChange([...value, role]);
      setSearch("");
      setShowDropdown(false);
    }
  };

  const addCustom = () => {
    const val = trimmed;
    if (!val || alreadySelected) return;
    // Case-insensitive duplicate check across all options
    if (!value.some(v => v.toLowerCase() === val.toLowerCase())) {
      onChange([...value, val]);
    }
    setSearch("");
    setShowDropdown(false);
  };

  if (viewMode) {
    return (
      <div className="flex flex-wrap gap-1.5 px-1">
        {value.length > 0
          ? value.map(r => (
              <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{r}</span>
            ))
          : <span className="text-gray-400 italic">—</span>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selected badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(r => (
            <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600 text-white">
              {r}
              <button type="button" onClick={() => onChange(value.filter(x => x !== r))} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative" ref={containerRef}>
        <Input
          placeholder="Search or add role..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered.length === 1) toggle(filtered[0]);
              else if (!exactMatch && search.trim()) addCustom();
            }
            if (e.key === "Escape") setShowDropdown(false);
          }}
          className="h-8 text-xs"
        />

        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(option => {
              const selected = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); toggle(option); }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${selected ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                >
                  {option}
                  {selected && <span className="text-indigo-400 text-xs">✓</span>}
                </button>
              );
            })}
            {trimmed && alreadySelected && (
              <div className="px-3 py-2 text-xs text-amber-600 italic border-t border-gray-100 flex items-center gap-1">
                "{trimmed}" is already added
              </div>
            )}
            {!exactMatch && trimmed && !alreadySelected && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addCustom(); }}
                className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 border-t border-gray-100 font-medium"
              >
                <Plus className="w-3 h-3" /> Add "{trimmed}"
              </button>
            )}
            {filtered.length === 0 && !trimmed && (
              <div className="px-3 py-2 text-xs text-gray-400 italic">Type to search roles...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}