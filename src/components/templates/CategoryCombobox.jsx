import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, X, AlertTriangle, Check, Plus } from "lucide-react";
import { similarity } from "./questionBankSimilarity";

const CATEGORY_SIMILARITY_THRESHOLD = 0.85;

/**
 * Find an existing category that is an exact or near-duplicate of `value`.
 * @param {string} value - the category text to check
 * @param {Array<string>} existing - array of existing category strings
 * @returns {string|null} the matching category, or null
 */
const findCategoryDuplicate = (value, existing = []) => {
  const target = (value || "").trim().toLowerCase();
  if (!target) return null;
  let best = null;
  let bestScore = 0;
  for (const c of existing) {
    const score = similarity(value, c);
    if (score >= CATEGORY_SIMILARITY_THRESHOLD && score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
};

/**
 * Combobox for selecting/adding categories with duplicate validation.
 *
 * Props:
 *   options — array of existing category strings (dropdown options)
 *   selected — array of currently selected categories
 *   onChange — callback(newArray) when selection changes
 */
export default function CategoryCombobox({ options = [], selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingDuplicate, setPendingDuplicate] = useState(null);

  const sortedOptions = useMemo(() => [...options].sort((a, b) => a.localeCompare(b)), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedOptions;
    return sortedOptions.filter((c) => c.toLowerCase().includes(q));
  }, [sortedOptions, query]);

  const addCategory = (raw, force = false) => {
    const c = (raw || "").trim();
    if (!c) return;
    if (selected.includes(c)) {
      setQuery("");
      return;
    }
    if (!force) {
      const dup = findCategoryDuplicate(c, options);
      if (dup && dup.toLowerCase() !== c.toLowerCase()) {
        setPendingDuplicate({ input: c, match: dup });
        return;
      }
    }
    onChange([...selected, c]);
    setQuery("");
    setPendingDuplicate(null);
  };

  const removeCategory = (c) => onChange(selected.filter((x) => x !== c));

  const exactInOptions = filtered.find((c) => c.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="space-y-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((c) => (
            <Badge key={c} variant="secondary" className="gap-1">
              {c}
              <button type="button" onClick={() => removeCategory(c)} className="hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQuery(""); setPendingDuplicate(null); } }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-8 text-sm font-normal text-muted-foreground"
          >
            {selected.length > 0 ? `${selected.length} categor${selected.length === 1 ? "y" : "ies"} selected` : "Select or type a category..."}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or type a new category..."
              value={query}
              onValueChange={(v) => { setQuery(v); setPendingDuplicate(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (exactInOptions) {
                    addCategory(exactInOptions);
                    setOpen(false);
                  } else {
                    addCategory(query);
                  }
                }
              }}
            />
            <CommandList>
              {pendingDuplicate && (
                <div className="m-1 p-2 rounded-md bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-amber-800">
                        This is similar to an existing category: <strong>"{pendingDuplicate.match}"</strong>. Add anyway?
                      </p>
                      <div className="flex gap-1.5 mt-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          onClick={() => {
                            addCategory(pendingDuplicate.input, true);
                            setPendingDuplicate(null);
                            setOpen(false);
                          }}
                        >
                          <Check className="w-3 h-3" /> Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2"
                          onClick={() => setPendingDuplicate(null)}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <CommandEmpty>
                {query.trim() ? (
                  <span className="text-xs">No match. Press Enter to add "{query.trim()}" as new.</span>
                ) : (
                  "No categories yet."
                )}
              </CommandEmpty>

              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem
                    key={c}
                    value={c}
                    onSelect={() => {
                      addCategory(c);
                      setOpen(false);
                    }}
                    disabled={selected.includes(c)}
                    className="gap-2"
                  >
                    <Check className={`w-3.5 h-3.5 ${selected.includes(c) ? "opacity-100" : "opacity-0"}`} />
                    {c}
                  </CommandItem>
                ))}
              </CommandGroup>

              {query.trim() && !exactInOptions && !pendingDuplicate && (
                <>
                  <div className="h-px bg-border mx-1" />
                  <CommandGroup heading="Create new">
                    <CommandItem
                      value={`__create__${query.trim()}`}
                      onSelect={() => {
                        addCategory(query.trim());
                        setOpen(false);
                      }}
                      className="gap-2 text-emerald-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add "{query.trim()}" as a new category
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}