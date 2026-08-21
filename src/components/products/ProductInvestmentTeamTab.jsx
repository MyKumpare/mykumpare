import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, StarOff, X, UserPlus, Search, User } from "lucide-react";
import AddContactDialog from "@/components/contacts/AddContactDialog";

// Inline contact picker that proactively shows all firm contacts in a
// compact, scrollable list. A search box narrows the list when needed.
function ContactPicker({ firmId, existingMemberIds, onAdd }) {
  const [search, setSearch] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-all"],
    queryFn: () => base44.entities.Contact.list("last_name", 500),
  });

  const getFullName = (c) =>
    [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

  const activeContacts = useMemo(() => contacts.filter((c) => !c.deleted_at), [contacts]);
  const searchLower = search.toLowerCase().trim();

  const firmContacts = useMemo(
    () =>
      activeContacts
        .filter(
          (c) => firmId && Array.isArray(c.firm_ids) && c.firm_ids.some((id) => String(id) === String(firmId))
        )
        .filter((c) => !existingMemberIds.includes(c.id))
        .filter((c) => !searchLower || getFullName(c).toLowerCase().includes(searchLower))
        .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "")),
    [activeContacts, firmId, existingMemberIds, searchLower]
  );

  const firmContactIds = useMemo(() => new Set(firmContacts.map((c) => c.id)), [firmContacts]);
  const otherContacts = useMemo(
    () =>
      activeContacts
        .filter((c) => !firmContactIds.has(c.id) && !existingMemberIds.includes(c.id))
        .filter((c) => !!searchLower && getFullName(c).toLowerCase().includes(searchLower))
        .sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "")),
    [activeContacts, firmContactIds, existingMemberIds, searchLower]
  );

  const renderRow = (c) => (
    <button
      key={c.id}
      type="button"
      onClick={() => onAdd(c)}
      className="w-full text-left px-2.5 py-2 rounded-md hover:bg-indigo-50 flex items-center gap-2.5 group transition-colors"
    >
      {c.photo_url ? (
        <img src={c.photo_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-indigo-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-800 truncate">
          {getFullName(c)}
          {c.designations?.length > 0 ? `, ${c.designations.join(", ")}` : ""}
        </div>
        {c.title && <div className="text-xs text-gray-400 truncate">{c.title}</div>}
      </div>
      <Plus className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 flex-shrink-0" />
    </button>
  );

  const hasFirmContacts = firmContacts.length > 0;
  const hasOtherContacts = otherContacts.length > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Search header */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100 bg-gray-50">
        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <input
          autoFocus
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          placeholder="Search contacts by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <span className="text-xs text-gray-400 flex-shrink-0">
            {firmContacts.length + otherContacts.length} match{firmContacts.length + otherContacts.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {/* Contact list */}
      <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
        {!hasFirmContacts && !hasOtherContacts ? (
          <div className="px-3 py-6 text-sm text-gray-400 italic text-center">
            {search ? "No matching contacts found" : "No contacts linked to this firm"}
          </div>
        ) : (
          <>
            {hasFirmContacts && (
              <div className="space-y-0.5">
                {firmId && (
                  <div className="px-2.5 pt-1 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Firm Contacts ({firmContacts.length})
                  </div>
                )}
                {firmContacts.map(renderRow)}
              </div>
            )}
            {hasOtherContacts && (
              <div className="space-y-0.5">
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Other Contacts ({otherContacts.length})
                </div>
                {otherContacts.map(renderRow)}
              </div>
            )}
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

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts-all"],
    queryFn: () => base44.entities.Contact.list("last_name", 500),
  });

  const team = product?.investment_team || [];
  const memberIds = team.map((m) => m.contact_id);

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
    const newTeam = [...team, { contact_id: contact.id, is_key: false }];
    updateTeam.mutate(newTeam);
    setShowPicker(false);
  };

  const handleRemove = (contactId) => {
    updateTeam.mutate(team.filter((m) => m.contact_id !== contactId));
  };

  const handleToggleKey = (contactId) => {
    updateTeam.mutate(
      team.map((m) =>
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

  // Sort: key members first, then alphabetically
  const sortedTeam = [...team].sort((a, b) => {
    if (a.is_key !== b.is_key) return a.is_key ? -1 : 1;
    const ca = allContacts.find((c) => c.id === a.contact_id);
    const cb = allContacts.find((c) => c.id === b.contact_id);
    return (ca?.last_name || "").localeCompare(cb?.last_name || "");
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
            const contact = allContacts.find((c) => c.id === member.contact_id);
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
                    {contact.first_name} {contact.last_name}
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