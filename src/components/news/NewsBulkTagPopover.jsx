import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Bulk tag popover — pick multiple contacts/firms to ADD to every selected
//    news article at once. Has its own selection state + Apply button so the
//    chosen set is applied in one shot (unlike the per-item tagger). ──
export default function NewsBulkTagPopover({ items, triggerLabel, triggerIcon: Icon, accent = "indigo", onApply }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter(it => (it.label || "").toLowerCase().includes(q)) : items;
    return [...filtered].sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }, [items, query]);

  const toggle = (id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const handleApply = () => {
    if (picked.length) onApply(picked);
    setPicked([]);
    setQuery("");
    setOpen(false);
  };

  const accentClasses = {
    indigo: { btn: "text-indigo-600 hover:bg-indigo-50", chk: "bg-indigo-600 border-indigo-600", ring: "focus:ring-indigo-400", apply: "bg-indigo-600 hover:bg-indigo-700" },
    purple: { btn: "text-purple-600 hover:bg-purple-50", chk: "bg-purple-600 border-purple-600", ring: "focus:ring-purple-400", apply: "bg-purple-600 hover:bg-purple-700" },
  }[accent];

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPicked([]); setQuery(""); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors ${accentClasses.btn} disabled:opacity-40 disabled:cursor-not-allowed`}
          disabled={!items.length}
          title={`Add ${triggerLabel.toLowerCase()} to all selected articles`}
        >
          <Icon className="w-3.5 h-3.5" />
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              autoFocus
              className={`w-full pl-8 pr-2 h-8 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-1 ${accentClasses.ring}`}
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">No items found</p>
          ) : (
            sorted.map(it => {
              const on = picked.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggle(it.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 text-left ${on ? "bg-gray-50" : ""}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? accentClasses.chk : "border-gray-300"}`}>
                    {on && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 truncate text-gray-700">{it.label}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="p-2 border-t flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{picked.length} selected to add</span>
          <Button type="button" size="sm" className={`h-7 text-xs text-white ${accentClasses.apply}`} disabled={!picked.length} onClick={handleApply}>
            Add Tags
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}