import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A single-select dropdown that also allows the user to type and add a custom option.
 */
export function CreatableSelect({ value, onChange, options, placeholder = "Select...", disabled = false, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customOptions, setCustomOptions] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = [...options, ...customOptions];
  const filtered = allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const canAdd = search.trim() && !allOptions.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  const select = (opt) => { onChange(opt); setSearch(""); setOpen(false); };
  const addAndSelect = () => {
    const v = search.trim();
    setCustomOptions((p) => [...p, v]);
    select(v);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-1.5 border-b">
            <input
              autoFocus
              className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder:text-muted-foreground"
              placeholder="Search or type to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canAdd) addAndSelect(); }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => select(opt)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                  value === opt && "font-medium"
                )}
              >
                {value === opt && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                <span className={value === opt ? "ml-0" : "ml-5"}>{opt}</span>
              </button>
            ))}
            {canAdd && (
              <button
                type="button"
                onClick={addAndSelect}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !canAdd && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No options found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A multi-select dropdown with creatable options.
 */
export function CreatableMultiSelect({ value = [], onChange, options, placeholder = "Select...", disabled = false, className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customOptions, setCustomOptions] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = [...options, ...customOptions];
  const filtered = allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const canAdd = search.trim() && !allOptions.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  const toggle = (opt) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  const addAndToggle = () => {
    const v = search.trim();
    setCustomOptions((p) => [...p, v]);
    onChange([...value, v]);
    setSearch("");
  };
  const remove = (opt, e) => { e.stopPropagation(); onChange(value.filter((v) => v !== opt)); };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className={cn(
          "flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 text-left"
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            value.map((v) => (
              <span key={v} className="flex items-center gap-1 bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">
                {v}
                {!disabled && <X className="h-3 w-3 cursor-pointer hover:text-indigo-900" onClick={(e) => remove(v, e)} />}
              </span>
            ))
          )}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-1.5 border-b">
            <input
              autoFocus
              className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder:text-muted-foreground"
              placeholder="Search or type to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canAdd) addAndToggle(); }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <div className={cn("h-4 w-4 rounded border flex items-center justify-center flex-shrink-0", value.includes(opt) ? "bg-indigo-600 border-indigo-600" : "border-gray-300")}>
                  {value.includes(opt) && <Check className="h-3 w-3 text-white" />}
                </div>
                {opt}
              </button>
            ))}
            {canAdd && (
              <button
                type="button"
                onClick={addAndToggle}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !canAdd && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No options found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}