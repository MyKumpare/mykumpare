import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, StarOff, X, UserPlus, Search, User, Check } from "lucide-react";
import AddContactDialog from "@/components/contacts/AddContactDialog";
import { dedupeContacts } from "@/components/contacts/contactDedupe";

// Normalized name key (lowercased, salutations/suffixes/designations stripped)
// so duplicate DB records for the same person collapse to one key.
const NAME_STOPWORDS = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof", "hon",
  "jr", "sr", "ii", "iii", "iv", "esq", "cfa", "cpa", "mba", "phd", "md",
]);
function nameKey(c) {
  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .trim()
      .replace(/[.'’\-(),]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !NAME_STOPWORDS.has(t) && !(t.length >= 2 && t === t.toUpperCase()))
      .join(" ")
      .trim();
  const first = (norm(c.first_name) || "").split(" ")[0] || "";
  const last = norm(c.last_name) || "";
  return `${first}|${last}`;
}

// Inline contact picker that proactively shows all contacts linked to the
// firm in a compact, scrollable list. Search narrows within firm contacts
// only — no global/other contacts are surfaced here.
function ContactPicker({ firmId, existingMemberIds, existingMemberNames, onAdd }) {
  const [search, setSearch] = useState("");

  // Fetch only this firm's contacts directly (avoids the 500-row global list
  // cap that was hiding later-alphabet firm contacts).
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts-by-firm", firmId],
    queryFn: () =>
      base44.entities.Contact.filter({ firm_ids: firmId, deleted_at: null }, "last_name", 500),
    enabled: !!firmId,
  });

  const getFullName = (c) =>
    [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
  const searchLower = search.toLowerCase().trim();

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);
  const existingNameKeys = useMemo(() => new Set(existingMemberNames), [existingMemberNames]);

  const firmContacts = useMemo(
    () =>
      dedupeContacts(contacts)
        .filter((c) => {
          // Hide contacts already on the team — by ID or by normalized name
          // (catches duplicate DB records for the same person).
          if (existingSet.has(c.id)) return false;
          if (existingNameKeys.has(nameKey(c))) return false;
          if (!searchLower) return true;
          return getFullName(c).toLowerCase().includes(searchLower);
        })
        .sort((a, b) => (a.first_name || "").localeCompare(b.first_name || "")),
    [contacts, searchLower, existingSet, existingNameKeys]
  );

  const renderRow = (c) => {
    const isAdded = existingSet.has(c.id);
    const avatar = c.photo_url ? (
      <img src={c.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
    ) : (
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-indigo-400" />
      </div>
    );
    const body = (
      <>
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-800 truncate">
            {getFullName(c)}
            {c.designations?.length > 0 ? `, ${c.designations.join(", ")}` : ""}
          </div>
          {c.title && <div className="text-xs text-gray-400 truncate">{c.title}</div>}
        </div>
        {isAdded ? (
          <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium flex-shrink-0">
            <Check className="w-4 h-4" /> Added
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="w-4 h-4" /> Add
          </span>
        )}
      </>
    );
    return isAdded ? (
      <div
        key={c.id}
        className="w-full px-2.5 py-2 rounded-lg flex items-center gap-2.5 bg-gray-50/70"
      >
        {body}
      </div>
    ) : (
      <button
        key={c.id}
        type="button"
        onClick={() => onAdd(c)}
        className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 hover:bg-indigo-50 group transition-colors"
      >
        {body}
      </button>
    );
  };

  const availableCount = firmContacts.length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Search header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          autoFocus
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          placeholder="Search firm contacts by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
          {isLoading ? "Loading…" : `${availableCount} available · ${firmContacts.length} total`}
        </span>
      </div>

      {/* Contact list */}
      <div className="max-h-80 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="px-3 py-8 text-sm text-gray-400 italic text-center">Loading firm contacts…</div>
        ) : firmContacts.length === 0 ? (
          <div className="px-3 py-8 text-sm text-gray-400 italic text-center">
            {search ? "No matching firm contacts" : "No contacts linked to this firm"}
          </div>
        ) : (
          <>
            <div className="px-1 pt-0.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Firm Contacts
            </div>
            {firmContacts.map(renderRow)}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductInvestmentTeamTab({ productId, firmId }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [viewingContact, setViewingContact] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // investment_team stored as array of { contact_id, is_key }
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => base44.entities.Product.filter({ id: productId }).then((r) => r[0]),
    enabled: !!productId,
  });

  const team = product?.investment_team || [];
  const memberIds = team.map((m) => m.contact_id);

  // Dedupe team entries by contact_id so the same person never appears twice,
  // even if duplicate entries exist in the stored data.
  const dedupedTeam = useMemo(() => {
    const seen = new Set();
    return team.filter((m) => {
      if (!m.contact_id || seen.has(m.contact_id)) return false;
      seen.add(m.contact_id);
      return true;
    });
  }, [team]);

  // Fetch only the contacts that are actually on this team (by id), so members
  // are never hidden by the 500-row global list cap.
  const { data: teamContacts = [] } = useQuery({
    queryKey: ["team-contacts", memberIds],
    queryFn: () =>
      memberIds.length ? base44.entities.Contact.filter({ id: { $in: memberIds } }) : [],
    enabled: memberIds.length > 0,
  });
  const contactMap = useMemo(() => {
    const m = new Map();
    teamContacts.forEach((c) => m.set(c.id, c));
    return m;
  }, [teamContacts]);

  const updateTeam = useMutation({
    mutationFn: (newTeam) =>
      base44.entities.Product.update(productId, { investment_team: newTeam }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    },
  });

  const handleAdd = (contact) => {
    // Only allow contacts that are linked to this product's firm — prevents
    // accidentally adding a contact from a different firm.
    if (!contact?.firm_ids?.includes(firmId)) {
      setShowPicker(false);
      setShowAddContact(false);
      return;
    }
    // Guard against adding the same contact twice (by ID or by normalized
    // name) — the picker filters them out, but this is a safety net.
    if (memberIds.includes(contact.id)) {
      setShowPicker(false);
      return;
    }
    const contactKey = nameKey(contact);
    const teamContactNames = dedupedTeam
      .map((m) => contactMap.get(m.contact_id))
      .filter(Boolean)
      .map(nameKey);
    if (teamContactNames.includes(contactKey)) {
      setShowPicker(false);
      return;
    }
    const newTeam = [...dedupedTeam, { contact_id: contact.id, is_key: false }];
    updateTeam.mutate(newTeam);
    setShowPicker(false);
  };

  const handleRemove = (contactId) => {
    updateTeam.mutate(dedupedTeam.filter((m) => m.contact_id !== contactId));
  };

  const handleToggleKey = (contactId) => {
    updateTeam.mutate(
      dedupedTeam.map((m) =>
        m.contact_id === contactId ? { ...m, is_key: !m.is_key } : m
      )
    );
  };

  const handleContactCreated = (contact) => {
    handleAdd(contact);
    setShowAddContact(false);
  };

  if (isLoading) {
    return <div className="text-xs text-gray-400 italic py-4 text-center">Loading...</div>;
  }

  const isSaving = updateTeam.isPending;

  // Sort: key members first, then alphabetically by first name
  const sortedTeam = [...dedupedTeam].sort((a, b) => {
    if (a.is_key !== b.is_key) return a.is_key ? -1 : 1;
    const ca = contactMap.get(a.contact_id);
    const cb = contactMap.get(b.contact_id);
    return (ca?.first_name || "").localeCompare(cb?.first_name || "");
  });

  return (
    <div className="space-y-3">
      {/* Auto-save status */}
      {(isSaving || savedFlash) && (
        <div className={`text-xs px-2 py-1 rounded text-center transition-all ${isSaving ? "bg-indigo-50 text-indigo-500" : "bg-green-50 text-green-600"}`}>
          {isSaving ? "Saving…" : "✓ Saved"}
        </div>
      )}
      {/* Member list */}
      {sortedTeam.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl">
          No team members added yet
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTeam.map((member) => {
            const contact = contactMap.get(member.contact_id);
            if (!contact) return null;
            return (
              <div
                key={member.contact_id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-white"
              >
                {/* Avatar */}
                {contact.photo_url ? (
                  <img
                    src={contact.photo_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0" />
                )}

                {/* Name & title — clickable */}
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    className="text-sm font-medium text-indigo-700 hover:underline truncate text-left"
                    onClick={() => setViewingContact(contact)}
                  >
                    {[contact.salutation, contact.first_name, contact.middle_name, contact.last_name, contact.suffix].filter(Boolean).join(" ")}
                    {member.is_key && (
                      <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
                        Key
                      </Badge>
                    )}
                  </button>
                  {contact.title && (
                    <div className="text-xs text-gray-400 truncate">{contact.title}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    title={member.is_key ? "Remove key flag" : "Flag as key"}
                    onClick={() => handleToggleKey(member.contact_id)}
                    className="p-1 rounded hover:bg-amber-50 transition-colors"
                  >
                    {member.is_key ? (
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ) : (
                      <StarOff className="w-4 h-4 text-gray-300 hover:text-amber-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Remove from team"
                    onClick={() => handleRemove(member.contact_id)}
                    className="p-1 rounded hover:bg-red-50 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-300 hover:text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add controls */}
      <div className="space-y-2 pt-1">
        {showPicker ? (
          <div className="space-y-2">
            <ContactPicker
              firmId={firmId}
              existingMemberIds={memberIds}
              existingMemberNames={dedupedTeam
                .map((m) => contactMap.get(m.contact_id))
                .filter(Boolean)
                .map(nameKey)}
              onAdd={handleAdd}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-50 gap-1"
                onClick={() => { setShowPicker(false); setShowAddContact(true); }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Contact not found? Add new
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gray-500"
                onClick={() => setShowPicker(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-50 gap-1"
            onClick={() => setShowPicker(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Add Team Member
          </Button>
        )}
      </div>

      {/* Add new contact dialog */}
      {showAddContact && (
        <AddContactDialog
          open={showAddContact}
          onOpenChange={setShowAddContact}
          currentFirmId={firmId}
          onContactCreated={handleContactCreated}
        />
      )}

      {/* View/edit contact dialog */}
      {viewingContact && (
        <AddContactDialog
          open={!!viewingContact}
          onOpenChange={(o) => { if (!o) setViewingContact(null); }}
          editingContact={viewingContact}
          viewMode={true}
        />
      )}
    </div>
  );
}