import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Multi-select dropdown of Investment Manager firms linked as sub-managers
// to a Multi-Manager Product. Shows a list of selected firms with remove buttons.
// options: [{ value, label }], value: string[] of firm ids.
export default function SubManagerFirmMultiSelect({
  options = [],
  value = [],
  onChange,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      ),
    [options, search]
  );

  const toggle = (id) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  const selectedFirms = options.filter((o) => value.includes(o.value));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-9 text-sm font-normal"
            type="button"
            disabled={disabled}
          >
            <span className="text-gray-400">
              {value.length === 0 ? "Select Investment Manager firms..." : `${value.length} selected`}
            </span>
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search firms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm pl-8"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400 italic text-center">
                No firms found
              </div>
            ) : (
              filtered.map((opt) => {
                const selected = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => toggle(opt.value)}
                  >
                    <div
                      className={cn(
                        "w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center",
                        selected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                      )}
                    >
                      {selected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{opt.label}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedFirms.length > 0 && (
        <div className="space-y-1.5">
          {selectedFirms.map((f) => (
            <div
              key={f.value}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-indigo-50 border border-indigo-200"
            >
              <span className="text-sm font-medium text-indigo-700 truncate">{f.label}</span>
              <button
                type="button"
                onClick={() => toggle(f.value)}
                className="text-indigo-400 hover:text-red-500 ml-2 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}