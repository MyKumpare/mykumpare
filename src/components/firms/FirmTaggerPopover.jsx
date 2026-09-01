import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, X, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Firm Tagger Popover — lets the user tag firms mentioned in a news
//    article. Tagged firm IDs are stored on the FirmNews record so the
//    news appears in each tagged firm's News tab. ──
export default function FirmTaggerPopover({ firms, taggedIds = [], onTagChange, size = "sm", excludeFirmId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const availableFirms = useMemo(
    () => firms.filter(f => f.id !== excludeFirmId),
    [firms, excludeFirmId]
  );

  const sortedFirms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? availableFirms.filter(f => (f.name || "").toLowerCase().includes(q))
      : availableFirms;
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [availableFirms, query]);

  const toggle = (id) => {
    const next = taggedIds.includes(id)
      ? taggedIds.filter(x => x !== id)
      : [...taggedIds, id];
    onTagChange(next);
  };

  const taggedFirms = firms.filter(f => taggedIds.includes(f.id));

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {taggedFirms.map(f => (
        <span key={f.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Building2 className="w-2.5 h-2.5" />
          {f.name}
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-0.5 ${size === "xs" ? "text-[10px]" : "text-xs"} text-gray-400 hover:text-purple-500 px-1 py-0.5 rounded hover:bg-purple-50 transition-colors`}
            title="Tag firms mentioned in this news"
          >
            <Building2 className={size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5"} />
            {taggedIds.length === 0 && <span>Tag firm</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search firms..."
                autoFocus
                className="w-full pl-8 pr-2 h-8 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {sortedFirms.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">No firms found</p>
            ) : (
              sortedFirms.map(f => {
                const isTagged = taggedIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle(f.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 text-left ${isTagged ? "bg-purple-50/50" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isTagged ? "bg-purple-600 border-purple-600" : "border-gray-300"}`}>
                      {isTagged && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex-1 truncate text-gray-700">{f.name}</span>
                  </button>
                );
              })
            )}
          </div>
          {taggedIds.length > 0 && (
            <div className="p-2 border-t flex items-center justify-between">
              <span className="text-[10px] text-gray-400">{taggedIds.length} tagged</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onTagChange([])}>
                Clear all
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}