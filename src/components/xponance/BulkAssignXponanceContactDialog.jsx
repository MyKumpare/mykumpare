import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, X, Check, UserCircle2, Loader2 } from "lucide-react";

const getFullName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

/**
 * Bulk-assign a single Xponance contact (primary or secondary) to multiple
 * selected firms, contacts, or portfolios at once.
 *
 * Props:
 *  - open / onOpenChange        — dialog visibility
 *  - entityType                 — "Firm" | "Contact" | "Portfolio" (for coverage counts + label)
 *  - entityLabel                — plural label shown in the description (e.g. "firms")
 *  - selectedCount              — number of selected entities
 *  - onAssign                   — ({ contact_id, contact_name, role }) => Promise
 *  - busy                       — boolean
 */
export default function BulkAssignXponanceContactDialog({
  open, onOpenChange, entityType, entityLabel = "records", selectedCount, onAssign, busy,
}) {
  const { user } = useAuth();
  const tenantFirmId = user?.linked_firm_id;
  const [role, setRole] = useState("primary");
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list("-created_date", 5000),
  });

  const xponanceContacts = useMemo(() => {
    const active = allContacts.filter((c) => !c.deleted_at);
    if (!tenantFirmId) return active;
    return active.filter((c) => (c.firm_ids || []).includes(tenantFirmId));
  }, [allContacts, tenantFirmId]);

  // Coverage counts for the active entity type
  const { data: firms = [] } = useQuery({
    queryKey: ["firms"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
    enabled: entityType === "Firm",
  });
  const { data: portfolios = [] } = useQuery({
    queryKey: ["portfolios-all"],
    queryFn: () => base44.entities.Portfolio.list("-created_date", 5000),
    enabled: entityType === "Portfolio",
  });

  const assignmentCounts = useMemo(() => {
    let source = [];
    if (entityType === "Firm") source = firms;
    else if (entityType === "Contact") source = allContacts;
    else if (entityType === "Portfolio") source = portfolios;
    const counts = {};
    for (const e of source) {
      if (e.deleted_at) continue;
      if (e.primary_xponance_contact_id) {
        counts[e.primary_xponance_contact_id] = counts[e.primary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[e.primary_xponance_contact_id].primary++;
      }
      if (e.secondary_xponance_contact_id) {
        counts[e.secondary_xponance_contact_id] = counts[e.secondary_xponance_contact_id] || { primary: 0, secondary: 0 };
        counts[e.secondary_xponance_contact_id].secondary++;
      }
    }
    return counts;
  }, [firms, allContacts, portfolios, entityType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = xponanceContacts;
    if (q) {
      list = list.filter((c) => {
        const name = getFullName(c).toLowerCase();
        const title = (c.title || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        return name.includes(q) || title.includes(q) || email.includes(q);
      });
    }
    return [...list].sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
  }, [xponanceContacts, search]);

  const handleClose = (v) => {
    if (!v) {
      setSearch("");
      setSelectedContact(null);
      setRole("primary");
    }
    onOpenChange(v);
  };

  const handleAssign = () => {
    if (!selectedContact || !onAssign) return;
    onAssign({
      contact_id: selectedContact.id,
      contact_name: getFullName(selectedContact),
      role,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Xponance Contact to {selectedCount} {entityLabel}</DialogTitle>
        </DialogHeader>

        {/* Role selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Assignment role</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("primary")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${role === "primary" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">P</span>
              Primary
            </button>
            <button
              type="button"
              onClick={() => setRole("secondary")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${role === "secondary" ? "border-violet-400 bg-violet-50 text-violet-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center">S</span>
              Secondary
            </button>
          </div>
        </div>

        {/* Contact search + list */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Select Xponance contact</label>
          <div className="border rounded-lg overflow-hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search Xponance contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); } }}
                className="w-full pl-8 pr-8 h-9 border-0 border-b text-sm focus:outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-gray-400 italic py-4">No Xponance contacts found</p>
              ) : (
                filtered.map((c) => {
                  const isSel = selectedContact?.id === c.id;
                  const ac = assignmentCounts[c.id];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContact(c)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 transition-colors ${isSel ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                    >
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <UserCircle2 className="w-4 h-4 text-indigo-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{getFullName(c)}</p>
                        {c.title && <p className="text-xs text-gray-400 truncate">{c.title}</p>}
                      </div>
                      {ac && (ac.primary > 0 || ac.secondary > 0) && (
                        <span className="flex items-center gap-1 text-[10px] flex-shrink-0">
                          {ac.primary > 0 && <span className="px-1 rounded bg-indigo-100 text-indigo-700 font-medium">P:{ac.primary}</span>}
                          {ac.secondary > 0 && <span className="px-1 rounded bg-violet-100 text-violet-700 font-medium">S:{ac.secondary}</span>}
                        </span>
                      )}
                      {isSel && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedContact || busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Assign to {selectedCount} {entityLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}