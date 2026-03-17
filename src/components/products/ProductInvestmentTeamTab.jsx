import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, StarOff, X, UserPlus, User } from "lucide-react";
import AddContactDialog from "@/components/contacts/AddContactDialog";

// A small searchable contact picker dropdown
function ContactPicker({ firmId, existingMemberIds, onAdd }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const firmContacts = contacts
    .filter((c) => c.firm_ids?.includes(firmId))
    .filter((c) => !existingMemberIds.includes(c.id))
    .filter((c) => {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      return fullName.includes(search.toLowerCase());
    })
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  return (
    <div className="relative">
      <input
        className="w-full h-8 px-3 text-sm rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Search contacts by name..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
          {firmContacts.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 italic">No matching contacts found</div>
          ) : (
            firmContacts.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex flex-col"
                onMouseDown={() => {
                  onAdd(c);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span className="font-medium text-gray-800">{c.first_name} {c.last_name}</span>
                {c.title && <span className="text-xs text-gray-400">{c.title}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductInvestmentTeamTab({ productId, firmId, isEditing }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [viewingContact, setViewingContact] = useState(null);

  // investment_team stored as array of { contact_id, is_key }
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => base44.entities.Product.filter({ id: productId }).then((r) => r[0]),
    enabled: !!productId,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const team = product?.investment_team || [];
  const memberIds = team.map((m) => m.contact_id);

  const updateTeam = useMutation({
    mutationFn: (newTeam) =>
      base44.entities.Product.update(productId, { investment_team: newTeam }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
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

  // Sort: key members first, then alphabetically
  const sortedTeam = [...team].sort((a, b) => {
    if (a.is_key !== b.is_key) return a.is_key ? -1 : 1;
    const ca = allContacts.find((c) => c.id === a.contact_id);
    const cb = allContacts.find((c) => c.id === b.contact_id);
    return (ca?.last_name || "").localeCompare(cb?.last_name || "");
  });

  return (
    <div className="space-y-3">
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
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-indigo-400" />
                  </div>
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
    </div>
  );
}