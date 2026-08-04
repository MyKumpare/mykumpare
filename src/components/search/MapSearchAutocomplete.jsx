import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, Building, User, MapPin } from "lucide-react";

/**
 * Generic character-based autocomplete input.
 * Shows matching suggestions as the user types and updates live.
 *
 * @param {string}   value        Current input value
 * @param {function} onChange     (newValue) => void
 * @param {function} onKeyDown    key handler for the input
 * @param {string}  placeholder  Input placeholder
 * @param {array}   suggestions   Array of { label, subLabel, type } objects
 * @param {string}  className     Extra classes for the input
 */
export default function MapSearchAutocomplete({
  value,
  onChange,
  onKeyDown,
  placeholder,
  suggestions = [],
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.label.toLowerCase().includes(q) || (s.subLabel || "").toLowerCase().includes(q))
      .slice(0, 10);
  }, [value, suggestions]);

  const showDropdown = open && filtered.length > 0;

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIdx(-1);
  }, [filtered]);

  // Close on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const selectSuggestion = (s) => {
    onChange(s.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKey = (e) => {
    if (showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        selectSuggestion(filtered[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const iconForType = (type) => {
    if (type === "firm") return <Building className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />;
    if (type === "contact") return <User className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />;
    return <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className={`w-full h-9 rounded-md border border-input bg-transparent pl-8 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-[1100] mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              type="button"
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => selectSuggestion(s)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0 ${
                i === activeIdx ? "bg-indigo-50" : "hover:bg-gray-50"
              }`}
            >
              {iconForType(s.type)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{s.label}</div>
                {s.subLabel && (
                  <div className="text-xs text-gray-400 truncate">{s.subLabel}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}