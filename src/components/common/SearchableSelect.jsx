import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search, Check } from "lucide-react";

/**
 * A searchable select dropdown using a Popover + search input + list.
 * Options: [{ value, label }]
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => (o.label || "").toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label || placeholder
    : placeholder;

  return (
    <Popover open={open && !disabled} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={`w-full justify-between font-normal ${className}`}
          onClick={() => setOpen(!open)}
        >
          <span className={value ? "text-gray-900" : "text-gray-400"}>{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">{emptyText}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                className="flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left"
              >
                <span className="truncate">{o.label}</span>
                {value === o.value && <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 ml-2" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}