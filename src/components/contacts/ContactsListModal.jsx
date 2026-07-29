import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { User, Search } from "lucide-react";
import AddContactDialog from "./AddContactDialog";

export default function ContactsListModal({ open, onOpenChange, contacts = [], firms = [], onNavigateToOwnership, onProductClick, onFirmClick }) {
  const [search, setSearch] = useState("");
  const [viewingContact, setViewingContact] = useState(null);

  const getFirmName = (id) => firms.find((f) => f.id === id)?.name || "";

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fullName = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ").toLowerCase();
    return (
      fullName.includes(q) ||
      c.firm_ids?.some((fid) => getFirmName(fid).toLowerCase().includes(q)) ||
      c.email?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q)
    );
  });

  const SALUTATIONS = ["mr.", "mrs.", "ms.", "dr.", "prof.", "hon.", "mr", "mrs", "ms", "dr", "prof", "hon"];
  const stripSalutation = (name) => {
    const n = (name || "").trim();
    const first = n.split(/\s+/)[0]?.toLowerCase().replace(".", "") || "";
    return SALUTATIONS.includes(first) ? n.split(/\s+/).slice(1).join(" ") : n;
  };
  const byFirstName = (a, b) => {
    const fn = stripSalutation(a.first_name).localeCompare(stripSalutation(b.first_name), undefined, { sensitivity: "base" });
    if (fn !== 0) return fn;
    return (a.last_name || "").localeCompare(b.last_name || "", undefined, { sensitivity: "base" });
  };
  // Group contacts by their primary (first) firm name, with firms sorted
  // ascending and contacts within each firm sorted by first name ascending.
  const grouped = (() => {
    const groups = new Map();
    for (const c of filtered) {
      const firmName = c.firm_ids?.length ? (getFirmName(c.firm_ids[0]) || "No Firm Assigned") : "No Firm Assigned";
      if (!groups.has(firmName)) groups.set(firmName, []);
      groups.get(firmName).push(c);
    }
    return [...groups.entries()]
      .map(([name, items]) => ({ name, items: items.sort(byFirstName) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  })();

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>All Contacts ({contacts.length})</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, firm, email, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 mt-1">
          {grouped.length === 0 ? (
            <div className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No contacts found" : "No contacts yet"}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.name} className="space-y-1.5">
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-1 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {group.name}
                </div>
                {group.items.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-indigo-50 hover:border-indigo-100 transition-colors cursor-pointer" onClick={() => setViewingContact(c)}>
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                      {c.photo_url
                        ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                        : <User className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-indigo-700 hover:underline">
                        {[c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ")}
                        {c.designations?.length > 0 && `, ${c.designations.join(", ")}`}
                      </div>
                      {c.title && <div className="text-xs text-gray-500">{c.title}</div>}
                      {c.email && <a href={`mailto:${c.email}`} className="text-xs text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>{c.email}</a>}
                      {c.firm_ids?.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.firm_ids.slice(1).map((fid) => (
                            <span key={fid} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                              {getFirmName(fid)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>

    {viewingContact && (
      <AddContactDialog
        open={!!viewingContact}
        onOpenChange={(o) => { if (!o) setViewingContact(null); }}
        editingContact={viewingContact}
        firms={firms}
        viewMode={true}
        onNavigateToOwnership={onNavigateToOwnership ? (firmId, ownershipId) => {
          setViewingContact(null);
          onOpenChange(false);
          onNavigateToOwnership(firmId, ownershipId);
        } : undefined}
        onProductClick={onProductClick ? (product) => {
          setViewingContact(null);
          onProductClick(product);
        } : undefined}
        onFirmClick={onFirmClick ? (firm) => {
          setViewingContact(null);
          onOpenChange(false);
          onFirmClick(firm);
        } : undefined}
      />
    )}
    </>
  );
}