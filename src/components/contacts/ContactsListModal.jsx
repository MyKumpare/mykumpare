import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Download, ChevronsDown, ChevronsUp, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddContactDialog from "./AddContactDialog";
import ContactsSectionFilters, { filterSectionContacts } from "./ContactsSectionFilters";
import { exportContactsToCSV } from "./exportContactsCsv";

export default function ContactsListModal({ open, onOpenChange, contacts = [], firms = [], products = [], portfolios = [], onNavigateToOwnership, onProductClick, onFirmClick }) {
  const [search, setSearch] = useState("");
  const [filterSelected, setFilterSelected] = useState({});
  const [viewingContact, setViewingContact] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  const getFirmName = (id) => firms.find((f) => f.id === id)?.name || "";

  const firmMap = React.useMemo(
    () => Object.fromEntries((firms || []).map((f) => [f.id, f])),
    [firms]
  );

  const filtered = filterSectionContacts(contacts, search, filterSelected, firmMap, products, portfolios);

  const handleToggleFilter = (fieldKey, value) => {
    setFilterSelected((prev) => {
      const next = { ...prev };
      const s = new Set(next[fieldKey] || []);
      if (s.has(value)) s.delete(value); else s.add(value);
      next[fieldKey] = s;
      return next;
    });
  };

  const handleClearFilters = () => {
    setFilterSelected({});
    setSearch("");
  };

  const handleExpandAll = () => setCollapsedGroups(new Set());
  const handleCollapseAll = () => setCollapsedGroups(new Set(grouped.map((g) => g.name)));
  const toggleGroup = (name) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
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
          <div className="flex items-center justify-between">
            <DialogTitle>All Contacts ({filtered.length})</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 gap-1 text-xs"
              onClick={() => exportContactsToCSV(filtered, firms)}
              title="Export contacts to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>
        </DialogHeader>

        <ContactsSectionFilters
          contacts={contacts}
          firms={firms}
          products={products}
          portfolios={portfolios}
          text={search}
          onTextChange={setSearch}
          selected={filterSelected}
          onToggle={handleToggleFilter}
          onClear={handleClearFilters}
        />

        <div className="flex items-center justify-end gap-3 px-1 pb-1">
          <button
            onClick={handleExpandAll}
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 font-medium"
          >
            <ChevronsDown className="w-3.5 h-3.5" />
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 font-medium"
          >
            <ChevronsUp className="w-3.5 h-3.5" />
            Collapse All
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 mt-1">
          {grouped.length === 0 ? (
            <div className="text-sm text-gray-400 italic text-center py-8">
              {search ? "No contacts found" : "No contacts yet"}
            </div>
          ) : (
            grouped.map((group) => {
              const isCollapsed = collapsedGroups.has(group.name);
              return (
              <div key={group.name} className="space-y-1.5">
                <div
                  className="sticky top-0 z-10 bg-white/95 backdrop-blur px-1 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 cursor-pointer hover:text-gray-700"
                  onClick={() => toggleGroup(group.name)}
                >
                  {isCollapsed
                    ? <ChevronRight className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{group.name}</span>
                  <span className="text-gray-400 normal-case font-normal">({group.items.length})</span>
                  {(() => {
                    const firmId = (group.items[0]?.firm_ids || [])[0];
                    const firmObj = firmId ? firms.find(f => f.id === firmId) : null;
                    return firmObj && onFirmClick ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onFirmClick(firmObj); onOpenChange(false); }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-700 hover:underline font-medium normal-case"
                      >
                        View →
                      </button>
                    ) : null;
                  })()}
                </div>
                {!isCollapsed && group.items.map((c) => (
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
                          {c.firm_ids.slice(1).map((fid) => {
                            const firmObj = firms.find(f => f.id === fid);
                            return (
                              <button
                                key={fid}
                                onClick={(e) => { e.stopPropagation(); if (firmObj && onFirmClick) { onFirmClick(firmObj); onOpenChange(false); } }}
                                className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:underline px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                {getFirmName(fid)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              );
            })
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