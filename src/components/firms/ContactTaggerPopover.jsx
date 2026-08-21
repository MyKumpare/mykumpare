import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPlus, X, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Contact Tagger Popover — lets the user tag contacts mentioned in a
//    news article. Tagged contact IDs are stored on the FirmNews record
//    so the news appears in each tagged contact's News tab.
//
//    Each contact row shows their photo and a clickable name hyperlink (when
//    `onContactClick` is supplied) so the user can open the contact's full
//    details without losing their tagging selection. ──
export default function ContactTaggerPopover({ contacts, taggedIds = [], onTagChange, size = "sm", onContactClick }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sortedContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? contacts.filter(c => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
          return name.includes(q) || (c.email || "").toLowerCase().includes(q);
        })
      : contacts;
    return [...filtered].sort((a, b) =>
      [a.first_name, a.last_name].join(" ").localeCompare([b.first_name, b.last_name].join(" "))
    );
  }, [contacts, query]);

  const toggle = (id) => {
    const next = taggedIds.includes(id)
      ? taggedIds.filter(x => x !== id)
      : [...taggedIds, id];
    onTagChange(next);
  };

  const taggedContacts = contacts.filter(c => taggedIds.includes(c.id));

  const fullName = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ");

  const Avatar = ({ c, className = "w-6 h-6" }) =>
    c.photo_url ? (
      <img src={c.photo_url} alt={fullName(c)} className={`${className} rounded-full object-cover flex-shrink-0 border border-gray-100`} />
    ) : (
      <div className={`${className} rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0 border border-gray-100`}>
        {(c.first_name || "")[0]}{(c.last_name || "")[0]}
      </div>
    );

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {taggedContacts.map(c => (
        <span key={c.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          {[c.first_name, c.last_name].filter(Boolean).join(" ")}
          <button type="button" onClick={() => toggle(c.id)} className="hover:text-red-500">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-0.5 ${size === "xs" ? "text-[10px]" : "text-xs"} text-gray-400 hover:text-indigo-500 px-1 py-0.5 rounded hover:bg-indigo-50 transition-colors`}
            title="Tag contacts mentioned in this news"
          >
            <UserPlus className={size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5"} />
            {taggedIds.length === 0 && <span>Tag contact</span>}
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
                placeholder="Search contacts..."
                autoFocus
                className="w-full pl-8 pr-2 h-8 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {sortedContacts.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">No contacts found</p>
            ) : (
              sortedContacts.map(c => {
                const isTagged = taggedIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 text-left ${isTagged ? "bg-indigo-50/50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="flex items-center gap-2 shrink-0"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isTagged ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                        {isTagged && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <Avatar c={c} />
                    </button>
                    {onContactClick ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onContactClick(c); setOpen(false); }}
                        className="flex-1 min-w-0 text-left text-indigo-600 hover:text-indigo-700 hover:underline truncate"
                        title={`View ${fullName(c)}`}
                      >
                        {fullName(c)}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className="flex-1 min-w-0 text-left text-gray-700 truncate"
                      >
                        {fullName(c)}
                      </button>
                    )}
                    {c.title && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{c.title}</span>}
                  </div>
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