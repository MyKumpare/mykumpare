import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ChevronDown } from "lucide-react";

// Searchable city combobox: shows static city suggestions instantly and
// queries the backend (Nominatim) as the user types for cities within the
// selected state/country. Falls back to free-text entry for anything not found.
export default function CitySearchCombobox({
  value,
  onChange,
  onCommit,
  country,
  stateName,
  staticCities = [],
  searchCitiesAsync,
  placeholder = "City",
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [asyncCities, setAsyncCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Keep the input in sync when the parent value changes externally
  // (e.g. postal-code auto-populate, map pick).
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Debounced async city search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2 || !country) {
      setAsyncCities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchCitiesAsync(query, stateName, country);
      setAsyncCities(results || []);
      setLoading(false);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, country, stateName]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Merge static + async results, dedupe case-insensitively, prioritize matches
  const merged = React.useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (c) => {
      if (c && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        out.push(c);
      }
    };
    // Static cities that match the current query (or all if query is short)
    const q = query.trim().toLowerCase();
    staticCities.forEach((c) => {
      if (!q || c.toLowerCase().includes(q)) add(c);
    });
    asyncCities.forEach(add);
    return out.slice(0, 30);
  }, [staticCities, asyncCities, query]);

  const selectCity = (city) => {
    setQuery(city);
    onChange(city);
    setOpen(false);
    setHighlight(-1);
    if (onCommit) onCommit();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown" && merged.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, merged.length - 1));
    } else if (e.key === "ArrowUp" && merged.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && highlight >= 0 && merged[highlight]) {
        e.preventDefault();
        selectCity(merged[highlight]);
      } else if (query.trim()) {
        onChange(query.trim());
        setOpen(false);
        if (onCommit) onCommit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <Input
          className="h-9 bg-white pl-8 pr-8"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // commit the typed value on blur if not selecting from list
            if (query.trim() && query.trim() !== value) {
              if (onCommit) onCommit();
            }
          }}
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 animate-spin" />
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        )}
      </div>
      {open && merged.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {merged.map((city, idx) => (
            <button
              type="button"
              key={city}
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectCity(city);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                idx === highlight ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}